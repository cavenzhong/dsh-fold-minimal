    /* ─────────────── 版本检测：官方固定菜单 / 「更多」兼容模式 ─────────────── */

    /**
     * 读取 Host 注入的 release 信息。
     *
     * `window.__DSH_BOOT__` 是 Web 启动协议里的公开入口，`release.version`
     * 由 Host 在打包时写入；开发态或自定义组合可能没有，此时返回 undefined。
     * @returns `{ version, commit? }` 或 undefined。
     */
    function readBootRelease() {
      try {
        var boot = typeof window !== 'undefined' ? window.__DSH_BOOT__ : undefined;
        var release = boot && boot.release;
        if (release && typeof release.version === 'string' && release.version.length > 0) {
          return {
            version: release.version,
            commit: typeof release.commit === 'string' ? release.commit : undefined,
          };
        }
      } catch (error) {
        // 启动协议被替换时不要影响插件加载。
      }
      return undefined;
    }

    /**
     * boot 图里是否加载了官方「更多」实现包。
     * 这比 release.version 更直接：自定义版本号或开发构建也能判定。
     * @returns 是否出现 entry-customization。
     */
    function bootHasOfficialMore() {
      try {
        var boot = typeof window !== 'undefined' ? window.__DSH_BOOT__ : undefined;
        var entries = boot && Array.isArray(boot.entries) ? boot.entries : [];
        for (var index = 0; index < entries.length; index += 1) {
          var entry = entries[index];
          if (entry && entry.id === OFFICIAL_MORE_PACKAGE) return true;
        }
      } catch (error) {
        // 启动图不可读时交给注册者/版本兜底。
      }
      return false;
    }

    /**
     * 解析 `major.minor.patch[-pre]`；无法解析时返回 null。
     * @param value - 版本字符串。
     * @returns `{ parts, pre }`。
     */
    function parseVersion(value) {
      if (typeof value !== 'string') return null;
      var match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value.trim());
      if (!match) return null;
      return {
        parts: [Number(match[1]), Number(match[2]), Number(match[3])],
        pre: match[4] ? match[4].split('.') : [],
      };
    }

    /**
     * 比较两个 semver 字符串（含 prerelease），用于版本兜底判断。
     * @param left - 左侧版本。
     * @param right - 右侧版本。
     * @returns <0 / 0 / >0；无法解析时按 0 处理。
     */
    function compareVersions(left, right) {
      var a = parseVersion(left);
      var b = parseVersion(right);
      if (!a || !b) return 0;
      for (var index = 0; index < 3; index += 1) {
        if (a.parts[index] !== b.parts[index]) return a.parts[index] - b.parts[index];
      }
      // 没有 prerelease 的正式版高于同号 prerelease。
      if (a.pre.length === 0 && b.pre.length === 0) return 0;
      if (a.pre.length === 0) return 1;
      if (b.pre.length === 0) return -1;
      var length = Math.max(a.pre.length, b.pre.length);
      for (var preIndex = 0; preIndex < length; preIndex += 1) {
        var x = a.pre[preIndex];
        var y = b.pre[preIndex];
        if (x === undefined) return -1;
        if (y === undefined) return 1;
        var xNumber = /^\d+$/.test(x);
        var yNumber = /^\d+$/.test(y);
        if (xNumber && yNumber) {
          if (Number(x) !== Number(y)) return Number(x) - Number(y);
        } else if (xNumber !== yNumber) {
          return xNumber ? -1 : 1;
        } else if (x !== y) {
          return x < y ? -1 : 1;
        }
      }
      return 0;
    }

    /**
     * 官方「更多」注册者是否已出现。
     * @param ctx - 客户端根上下文。
     * @returns 是否找到 entry-customization。
     */
    function hasOfficialMore(ctx) {
      try {
        if (typeof ctx.slots.spec === 'function' && !ctx.slots.spec('sidebar.panellist.actions')) {
          return false;
        }
        var entries = ctx.slots.entriesOfSlot('sidebar.panellist.actions');
        for (var index = 0; index < entries.length; index += 1) {
          var options = entries[index] && entries[index].options;
          if (options && options.id === OFFICIAL_MORE_ID) return true;
        }
      } catch (error) {
        // 槽位尚未声明或读取失败时由版本号兜底。
      }
      return false;
    }

    /**
     * 判定运行环境的面板收纳来源。
     *
     * - 官方 0.2.2+：固定菜单与「更多」由官方维护，本插件只同步显示与排序；
     * - 旧版：保留插件自己的隐藏 / 二级区。
     *
     * 优先看 boot release，其次看官方 entry-customization 注册者；两者任一命中
     * 都走新版。这样开发构建缺 release 时仍能靠 API 探测降级/升级。
     * @param ctx - 客户端根上下文。
     * @returns `{ releaseVersion, officialPins }`。
     */
    function createCapabilities(ctx) {
      var release = readBootRelease();
      var officialPins = false;
      if (release && parseVersion(release.version)) officialPins = compareVersions(release.version, OFFICIAL_MORE_RELEASE) >= 0;
      if (!officialPins) officialPins = bootHasOfficialMore();
      if (!officialPins && hasOfficialMore(ctx)) officialPins = true;
      return {
        releaseVersion: release ? release.version : null,
        officialPins: officialPins,
      };
    }

    /**
     * 从官方 shell.leading 注册项里取 `setPinned` 与 `hooks.entryPins`。
     *
     * `ui-sidebar` 把 `{ setPinned, hooks.entryPins }` 放在它自己的 inject 结果里；
     * 折叠工具栏的拖动需要跨固定边界时，直接调用这个函数，不模拟点击、不维护
     * 第二套固定状态。找不到时返回 null，调用方降级为区内排序。
     * @param ctx - 客户端根上下文。
     * @returns 官方注入属性，或 null。
     */
    function resolveOfficialSidebar(ctx) {
      try {
        if (!ctx.slots || typeof ctx.slots.entries !== 'function') return null;
        var entries = ctx.slots.entries(SLOT);
        for (var index = 0; index < entries.length; index += 1) {
          var entry = entries[index];
          if (!entry) continue;
          var inject = typeof entry.inject === 'function'
            ? entry.inject
            : entry.options && typeof entry.options.inject === 'function'
              ? entry.options.inject
              : null;
          if (!inject) continue;
          var injected;
          try {
            injected = inject();
          } catch (error) {
            continue;
          }
          if (
            injected &&
            typeof injected.setPinned === 'function' &&
            injected.hooks &&
            injected.hooks.entryPins
          ) {
            return injected;
          }
        }
      } catch (error) {
        // 自定义组合可能没有官方侧栏；降级为区内排序。
      }
      return null;
    }

    /** 官方拒绝变更（例如 plugins 始终固定）时，不提交跨区排序。 */
    function setOfficialPinned(ctx, id, pinned) {
      var official = resolveOfficialSidebar(ctx);
      if (!official) return false;
      try {
        official.setPinned(id, pinned);
        var source = official.hooks.entryPins;
        if (source && typeof source.getSnapshot === 'function') {
          var unpinned = source.getSnapshot();
          if (Array.isArray(unpinned)) return (unpinned.indexOf(id) === -1) === pinned;
        }
        return true;
      } catch (error) {
        return false;
      }
    }

    /**
     * 新版折叠工具栏切分：只平铺官方固定（pinned）的面板，未固定面板与溢出项
     * 一起进「更多」。这样折叠菜单与展开侧栏看到的固定集合一致。
     * @param panels - 已按生效顺序排列的面板快照。
     * @param pinnedIds - 当前固定面板 id；`null` 表示尚未观测到，先按全部固定处理。
     * @param slots - 工具栏格数。
     * @returns `{ visible, more, pinned, unpinned }`。
     */
    function splitOfficialPanels(panels, pinnedIds, slots) {
      var limit = Number.isFinite(slots) ? slots : PANEL_SLOTS;
      var known = Array.isArray(pinnedIds);
      var pinnedSet = Object.create(null);
      if (known) {
        for (var pinnedIndex = 0; pinnedIndex < pinnedIds.length; pinnedIndex += 1) {
          pinnedSet[pinnedIds[pinnedIndex]] = true;
        }
      }
      var pinned = [];
      var unpinned = [];
      for (var index = 0; index < panels.length; index += 1) {
        if (!known || pinnedSet[panels[index].id]) pinned.push(panels[index]);
        else unpinned.push(panels[index]);
      }
      var needsMore = pinned.length > limit || unpinned.length > 0;
      var visible = needsMore ? pinned.slice(0, Math.max(0, limit - 1)) : pinned;
      var visibleSet = Object.create(null);
      for (var visibleIndex = 0; visibleIndex < visible.length; visibleIndex += 1) {
        visibleSet[visible[visibleIndex].id] = true;
      }
      var more = [];
      for (var scan = 0; scan < panels.length; scan += 1) {
        if (!visibleSet[panels[scan].id]) more.push(panels[scan]);
      }
      return { visible: visible, more: more, pinned: pinned, unpinned: unpinned };
    }

    /**
     * 用新的分组顺序替换完整顺序里同一组的位置，组外项保持原位置。
     * @param allOrder - 完整顺序。
     * @param bucketIds - 被重排的分组 id。
     * @param bucketOrder - 分组的新顺序。
     * @returns 新完整顺序；长度对不上时原样返回。
     */
    function replaceBucketOrder(allOrder, bucketIds, bucketOrder) {
      var bucketSet = Object.create(null);
      for (var index = 0; index < bucketIds.length; index += 1) bucketSet[bucketIds[index]] = true;
      var next = [];
      var cursor = 0;
      for (var scan = 0; scan < allOrder.length; scan += 1) {
        var id = allOrder[scan];
        if (!bucketSet[id]) {
          next.push(id);
          continue;
        }
        if (cursor >= bucketOrder.length) return allOrder.slice();
        next.push(bucketOrder[cursor]);
        cursor += 1;
      }
      return cursor === bucketOrder.length ? next : allOrder.slice();
    }

    /**
     * 在某个分组内移动一项并写回完整顺序。展开侧栏、折叠工具栏和「更多」
     * 浮层都通过它提交，避免各自维护一套顺序。
     * @param store - 布局 store。
     * @param panels - 面板快照。
     * @param bucketIds - 参与本次排序的分组 id。
     * @param id - 被拖拽的 id。
     * @param index - 目标下标（移除被拖项后的序列）。
     * @returns 是否提交。
     */
    function reorderBucket(store, panels, bucketIds, id, index) {
      var all = panelIdsOf(panelsInOrder(panels, store.getSnapshot().order));
      var bucket = [];
      for (var indexScan = 0; indexScan < all.length; indexScan += 1) {
        if (bucketIds.indexOf(all[indexScan]) !== -1) bucket.push(all[indexScan]);
      }
      if (bucket.indexOf(id) === -1) return false;
      var moved = moveVisibleOrder(bucket, id, index);
      var next = replaceBucketOrder(all, bucket, moved);
      store.setOrder(next);
      return true;
    }

    /**
     * 计算一次跨区落点要修改的 pin 意图与目标分组。
     *
     * `pinnedSet === null` 表示固定状态未知，先按全部固定处理。返回的 bucket
     * 可以直接交给 `reorderBucket`。
     * @param allIds - 完整顺序。
     * @param pinnedSet - 当前固定集合，或 null。
     * @param draggedId - 被拖拽的面板 id。
     * @param destinationPinned - 目标区是否固定。
     * @returns `{ bucket, pinChange, currentPinned }`。
     */
    function officialDropPlan(allIds, pinnedSet, draggedId, destinationPinned) {
      var currentPinned = pinnedSet === null ? true : pinnedSet[draggedId] === true;
      var bucket = [];
      for (var scan = 0; scan < allIds.length; scan += 1) {
        var id = allIds[scan];
        var pinnedFor = id === draggedId
          ? destinationPinned
          : pinnedSet === null
            ? true
            : pinnedSet[id] === true;
        if (pinnedFor === destinationPinned) bucket.push(id);
      }
      return {
        bucket: bucket,
        pinChange: currentPinned !== destinationPinned,
        currentPinned: currentPinned,
      };
    }

    /**
     * 官方固定状态的小型 observable store。
     *
     * `pinned === null` 表示尚未观测到（折叠工具栏先按全部显示）；
     * 观测到之后，`pinned` 是当前固定的 id 数组。
     * @returns `{ observable, getPinned, setPinned, setFromEntries }`。
     */
