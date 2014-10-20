;(function(window, undefined) {
  window.shani = {
    compile: function(tpl) {
      var code = tpl.replace(/(\n|\r)/g, '')
                    .replace(/(%\}|^)(.*?)(\{%|$)/g, function(_, a, b, c) {
                      return a + '__acc__ += \'' + b + '\'; ' + c;
                    })
                    .replace(/\{%\s*(if|else if)\s+(.*?)\s*%\}/g, function(_, a, b) {
                      var sf = (a === 'if') ? '' : ' } ';
                      b = b.replace(/(.*?\s+)(and|or)(\s+.*?)/g, function(_, a, b, c) {
                        return a + (b === 'and' ? '&&' : '||') + c;
                      });
                      return sf + a + ' (' + b + ') { ';
                    })
                    .replace(/\{%\s*for\s+([a-zA-Z_][a-zA-Z0-9_]*),\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*%\}/g, function(_, k, v, lst) {
                      return 'for (var ' + k + ' in ' + lst + ') { var ' + v + ' = ' + lst + '[' + k + '];  if (typeof ' + v + ' === \'function\') continue; if (' + k + ' === \'__c__\') continue; ';
                    })
                    .replace(/\{%\s*else\s*%\}/g, ' } else { ')
                    .replace(/\{%\s*end\s*%\}/g, ' } ')
                    .replace(/\{\{\s*(.*?)\s*\}\}/g, function(_, k) {
                      return '\' + (' + k + ') + \'';
                    });
      return function(scope) {
        return (new Function('with(this) {var __acc__ = ""; ' + code + '; return __acc__;}')).call(scope);
      };
    }
  };
})(window);
