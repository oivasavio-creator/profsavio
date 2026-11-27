/* Runtime leve do site profsavio.com: renderiza o modelo da página e atualiza o estado sem recarregar. */
(function () {
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);
    if (this._render) this._render();
  };
  DCLogic.prototype.forceUpdate = function () { if (this._render) this._render(); };

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function whole(str) { var m = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(str); return m ? m[1] : null; }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = lookup(p, scope); return v == null ? '' : String(v); });
  }

  function render(node, scope, out, refs) {
    if (node.nodeType === 3) { out.push(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-for') {
      var list = lookup(whole(node.getAttribute('list')) || '', scope) || [];
      var as = node.getAttribute('as') || 'item';
      list.forEach(function (item, i) {
        var s = Object.create(scope); s[as] = item; s.$index = i;
        node.childNodes.forEach(function (c) { render(c, s, out, refs); });
      });
      return;
    }
    if (tag === 'sc-if') {
      if (lookup(whole(node.getAttribute('value')) || 'false', scope)) node.childNodes.forEach(function (c) { render(c, scope, out, refs); });
      return;
    }
    var el = node.cloneNode(false);
    Array.prototype.slice.call(node.attributes).forEach(function (at) {
      var name = at.name, val = at.value;
      if (name.indexOf('hint-') === 0) { el.removeAttribute(name); return; }
      var w = whole(val);
      if (name.indexOf('on') === 0) { el.removeAttribute(name); if (w) el['on' + name.slice(2)] = lookup(w, scope) || null; return; }
      if (name === 'ref') { el.removeAttribute(name); var fn = w && lookup(w, scope); if (fn) refs.push([el, fn]); return; }
      if (w) {
        var v = lookup(w, scope);
        if (v === true) el.setAttribute(name, '');
        else if (v === false || v == null) el.removeAttribute(name);
        else el.setAttribute(name, String(v));
      } else if (val.indexOf('{{') >= 0) el.setAttribute(name, interp(val, scope));
    });
    node.childNodes.forEach(function (c) { var kids = []; render(c, scope, kids, refs); kids.forEach(function (k) { el.appendChild(k); }); });
    out.push(el);
  }

  function morph(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.parentNode.replaceChild(b, a); return; }
    b._target = a;
    if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    Array.prototype.slice.call(a.attributes).forEach(function (at) { if (!b.hasAttribute(at.name)) a.removeAttribute(at.name); });
    Array.prototype.slice.call(b.attributes).forEach(function (at) { if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value); });
    a.onclick = b.onclick || null;
    morphChildren(a, b);
  }
  function morphChildren(a, b) {
    var ac = Array.prototype.slice.call(a.childNodes), bc = Array.prototype.slice.call(b.childNodes);
    for (var i = 0; i < bc.length; i++) { if (i < ac.length) morph(ac[i], bc[i]); else a.appendChild(bc[i]); }
    for (var j = bc.length; j < ac.length; j++) a.removeChild(ac[j]);
  }

  function mount(Component) {
    var tpl = document.getElementById('dc-template');
    var root = document.getElementById('app');
    var comp = new Component({});
    comp._render = function () {
      var scope = comp.renderVals() || {}, out = [], refs = [];
      tpl.content.childNodes.forEach(function (c) { render(c, scope, out, refs); });
      var fresh = document.createElement('div');
      out.forEach(function (n) { fresh.appendChild(n); });
      morphChildren(root, fresh);
      refs.forEach(function (r) { try { r[1](r[0]._target || r[0]); } catch (e) {} });
    };
    comp._render();
    if (comp.componentDidMount) comp.componentDidMount();
  }

  window.DCLogic = DCLogic;
  window.DC = { mount: mount };
})();
