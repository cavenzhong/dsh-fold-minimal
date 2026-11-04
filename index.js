/**
 * dsh-fold-minimal —— Host 半。
 *
 * 本插件只在浏览器里渲染折叠态工具栏，Host 侧不注册任何服务、工具或提示词；
 * 保留这个入口是因为 bundle 的 Loader 行需要一个可挂载的包主模块。
 */
export function apply() {}
