/* 最小 React 替身：只要 createElement 能造出元素就够（本页只调纯函数与导出） */
window.__REACT_STUB__ = {
  createElement: function (t, p) { var k = [].slice.call(arguments, 2); return { type: t, props: Object.assign({}, p, k.length ? { children: k.length === 1 ? k[0] : k } : {}) } },
  Fragment: 'frag',
  useState: function (v) { return [typeof v === 'function' ? v() : v, function () {}] },
  useEffect: function () {}, useMemo: function (f) { return f() }, useRef: function (v) { return { current: v } },
  useCallback: function (f) { return f }, memo: function (c) { return c },
  Component: function () {}, version: 'stub',
}
