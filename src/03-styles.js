    /* ───────────────────────────── 样式 ───────────────────────────── */

    var CSS_TAG = 'dsh-fold-minimal/FoldMinimal.css';
    var CSS = [
      // 一行图标；tooltip 绝对定位在按钮下方，靠 :hover / :focus-visible 显示。
      '.DFM_rail{box-sizing:border-box;display:flex;align-items:center;gap:2px;height:28px}',
      '.DFM_divider{flex:none;width:1px;height:16px;margin:0 6px;border-radius:1px;',
      'background:var(--dsw-alias-border-l2);opacity:.55}',
      '.DFM_button{box-sizing:border-box;position:relative;flex:none;display:inline-flex;align-items:center;',
      'justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-sm);',
      'background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;-webkit-app-region:no-drag}',
      '.DFM_button:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_button:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.DFM_button.DFM_active{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.DFM_svg{display:block;flex:none}',
      '.DFM_tip{position:absolute;z-index:40;top:calc(100% + 7px);left:50%;transform:translateX(-50%);',
      'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:var(--dsw-radius-sm);',
      'background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:16px;',
      'white-space:nowrap;pointer-events:none;visibility:hidden;opacity:0;',
      'box-shadow:var(--dsw-elevation-prominent,0 6px 16px rgba(0,0,0,.18))}',
      '.DFM_button:hover .DFM_tip,.DFM_button:focus-visible .DFM_tip{visibility:visible;opacity:1;',
      'transition:opacity .1s ease .38s,visibility 0s linear .38s}',
      '.DFM_kbd{font:inherit;opacity:.7}',
      // 「更多」的悬停菜单：贴着按钮下缘展开，只画一层浮层，不引入新容器。
      '.DFM_more{position:relative;flex:none}',
      '.DFM_menu{position:absolute;top:calc(100% + 6px);left:0;z-index:60;display:flex;flex-direction:column;',
      'gap:1px;min-width:168px;max-width:260px;padding:4px;border-radius:var(--dsw-radius-md);',
      // --dsw-specific-menu：浅色是近乎白的 #f8f9fa，深色是 #303136，跟随主题。
      'background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay));',
      'box-shadow:var(--dsw-elevation-prominent,0 6px 16px rgba(0,0,0,.18))}',
      '.DFM_menuItem{box-sizing:border-box;display:flex;align-items:center;gap:8px;height:30px;padding:0 8px;',
      'border:none;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);',
      'font:inherit;font-size:13px;line-height:18px;text-align:left;cursor:pointer}',
      '.DFM_menuItem:hover,.DFM_menuItem.DFM_active{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_menuItem:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.DFM_menuItem[' + RAIL_MENU_ID_ATTR + ']{cursor:grab}',
      '.DFM_menuItem.DFM_rowDragging{opacity:.5}',
      // 折叠工具栏的「更多」浮层挂到 body：避免被主面板的层叠上下文/标题栏裁切，
      // 也让悬停区域不再依赖按钮自身的盒子。
      '.DFM_menu[data-dfm-menu-portal="true"]{position:fixed;z-index:100010;max-height:min(60vh,420px);overflow:auto}',
      '.DFM_menuLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      // 拖拽进入「松手即折叠」的距离后，指针换成向左收起的形状（深浅主题各一支）。
      'html[' + ARMED_ATTR + '],html[' + ARMED_ATTR + '] *{cursor:' + ARMED_CURSOR_LIGHT + ' !important}',
      'html[' + ARMED_ATTR + '] body[data-ds-dark-theme],html[' + ARMED_ATTR + '] body[data-ds-dark-theme] *{',
      'cursor:' + ARMED_CURSOR_DARK + ' !important}',

      /* ───────── v0.4：展开态返回按钮 / 二级区 / 设置行 ───────── */
      // 展开态返回按钮：注入到侧栏 topStrip，用 order 排到收起按钮左侧。
      '.DFM_topBack{box-sizing:border-box;order:-1;flex:none;display:inline-flex;align-items:center;',
      'justify-content:center;width:28px;height:28px;margin:0;padding:0;border:none;',
      'border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-secondary);',
      'cursor:pointer;-webkit-app-region:no-drag}',
      '.DFM_topBack:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_topBack:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      // 「更多」行右侧的展开箭头（绝对定位在 More 行上，不嵌套进宿主 button）。
      '.DFM_moreChevron{position:absolute;right:4px;top:50%;transform:translateY(-50%);z-index:2;',
      'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;',
      'padding:0;border:none;border-radius:var(--dsw-radius-sm);background:transparent;',
      'color:var(--dsw-alias-label-tertiary);cursor:pointer}',
      '.DFM_moreChevron:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}',
      '.DFM_moreChevron:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.DFM_moreChevron svg{display:block;transition:transform .12s ease}',
      '.DFM_moreChevron[data-open="true"] svg{transform:rotate(90deg)}',
      // 「更多」下方的二级区：稍微右缩进，拖拽悬停时整块高亮。
      '.DFM_tray{box-sizing:border-box;display:flex;flex-direction:column;gap:2px;',
      '--dfm-tray-border:color-mix(in srgb,var(--dsw-alias-label-tertiary,#9ca3af) 25%,white);',
      'margin:0 0 4px 14px;padding:4px;border:1px dashed var(--dfm-tray-border);',
      'border-radius:var(--dsw-radius-md);max-height:320px;overflow:auto}',
      '.DFM_tray:empty{display:none}',
      '.DFM_tray[hidden]{display:none}',
      '.DFM_tray[data-dfm-drop="true"]{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_trayRow{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;',
      'min-height:32px;margin:0;padding:4px 10px;border:none;border-radius:var(--dsw-radius-sm);',
      'background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;',
      'line-height:18px;text-align:left;cursor:grab}',
      '.DFM_trayRow:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.DFM_trayRow:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:-2px}',
      '.DFM_trayRow[data-dfm-dragging="true"]{opacity:.5}',
      '.DFM_trayLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.DFM_trayEmpty{box-sizing:border-box;margin:0;padding:8px 10px;color:var(--dsw-alias-label-tertiary);',
      'font-size:12px;line-height:18px}',
      '.DFM_trayFooter{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:2px 2px 4px}',
      '.DFM_linkButton{border:none;background:transparent;color:var(--dsw-alias-brand-primary);',
      'font:inherit;font-size:12px;line-height:18px;padding:2px 4px;border-radius:var(--dsw-radius-sm);cursor:pointer}',
      '.DFM_linkButton:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      // 「更多」菜单里被拆分出来的分组。
      '.DFM_menuDivider{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l2);opacity:.7}',
      '.DFM_menuGroup{padding:4px 8px 2px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}',
      // 插件详情页组件开关行（版式与宿主偏好行一致）。
      '.DFM_pluginSettings{width:100%}',
      '.DFM_setRow{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;',
      'gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}',
      '.DFM_setRowLast{border-bottom:none}',
      '.DFM_setText{min-width:0}',
      '.DFM_setTitle{font-size:14px;line-height:20px}',
      '.DFM_setDesc{margin-top:4px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.DFM_compatNote{margin-top:12px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
      // Switch 直接照宿主 primitive 的样式复制，只用主题 token。
      '.DFM_switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;',
      'border:0;border-radius:999px;corner-shape:round;background:var(--dsw-alias-border-l3);cursor:pointer}',
      '.DFM_switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}',
      '.DFM_switch:disabled{cursor:default;opacity:.5}',
      '.DFM_switch:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid ',
      'var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}',
      '.DFM_switchThumb{display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;',
      'background:var(--dsw-alias-label-primary-foreground);transition:transform .12s ease}',
      '.DFM_switch[aria-checked="false"] .DFM_switchThumb{background:var(--dsw-alias-switch-thumb)}',
      '.DFM_switch[aria-checked="true"] .DFM_switchThumb{transform:translate(16px)}',
      // 与宿主工作区的 dropBefore/dropAfter 共用绘制参数：12px 箭头 + 2px 线。
      // 折叠工具栏把同一图形旋转 90°，只改变朝向，不改变箭头大小和线宽。
      '.DFM_indicator{position:fixed;z-index:99999;pointer-events:none;',
      'transform-origin:0 0;background:',
      'linear-gradient(55deg,transparent calc(50% - 1px),var(--dsw-alias-state-business-primary) ',
      'calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat,',
      'linear-gradient(125deg,transparent calc(50% - 1px),var(--dsw-alias-state-business-primary) ',
      'calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat,',
      'linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat}',
      '.DFM_indicator[data-axis="horizontal"]{transform:rotate(90deg)}',
      // 拖动时把显示区与隐藏区分隔开，隐藏区用浅色说明提示用途。
      '.DFM_railZone{display:flex;flex:none;align-items:center;gap:2px;min-width:28px;min-height:28px}',
      '.DFM_railHidden{padding-right:8px}',
      '.DFM_railZone + .DFM_divider{background:var(--dsw-alias-border-l3,var(--dsw-alias-label-tertiary,#9ca3af));opacity:.7}',
      '.DFM_railHint{padding:0 6px;color:var(--dsw-alias-label-tertiary,#9ca3af);',
      'font-size:11px;line-height:16px;white-space:nowrap}',
      '.DFM_railHidden .DFM_button{color:var(--dsw-alias-label-tertiary,#9ca3af)}',
      // 「更多」按钮只变底色；虚线边框只出现在下方二级区。
      '[' + MORE_ROW_ATTR + '][' + DROP_ATTR + '="true"]{background:var(--dsw-alias-interactive-bg-hover);',
      'border-radius:var(--dsw-radius-md)}',
      // 拖拽面板行时的全局指针/选区状态。
      'html[' + DRAG_ROOT_ATTR + ']{user-select:none}',
      'html[' + DRAG_ROOT_ATTR + '] *{cursor:grabbing !important}',
      '.DFM_rowDragging{opacity:.5}',
      '.DFM_dragGhost{position:fixed;z-index:100000;pointer-events:none;display:flex;',
      'align-items:center;justify-content:center;width:28px;height:28px;border-radius:var(--dsw-radius-sm);',
      'background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay));color:var(--dsw-alias-label-primary);',
      'box-shadow:var(--dsw-elevation-prominent,0 6px 16px rgba(0,0,0,.18))}',
      '.DFM_dragGhost svg{width:16px;height:16px}',
      'html[' + DRAG_ROOT_ATTR + '] .DFM_tip{display:none}',
    ].join('');

    /** 注入本插件样式；返回清理函数。 */
    function injectStyles() {
      if (typeof document === 'undefined' || !document.head) return undefined;
      var tag = document.createElement('style');
      tag.dataset.plugin = 'fold-minimal';
      tag.dataset.pluginCss = CSS_TAG;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return function () {
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      };
    }
