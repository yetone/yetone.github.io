$(function() {
  var $D = $(document),
      $main = $('#main'),
      username = 'yetone',
      version = '0.1.2',
      gistListTpl = $('#gist-list-tpl').html(),
      gistDetailTpl = $('#gist-detail-tpl').html(),
      filename = '!.md',
      routers = [
        [/^\/blog\/([^\/]*)/, blogDetailHandler],
        [/^\/$/, homeHandler]
      ],
      languageOverrides = {
        js: 'javascript',
        html: 'xml'
      };

  marked.setOptions({
    highlight: function(code, lang) {
      if (languageOverrides[lang]) lang = languageOverrides[lang];
      return hljs.LANGUAGES[lang] ? hljs.highlight(lang, code).value : code;
    }
  });

  function getPromise(opt) {
    var promise = $.ajax({
      url: opt.url,
      type: opt.type || 'GET'
    });
    return promise;
  }
  function addLoading() {
    removeLoading();
    var $loadingBg = $('<div id="loading-bg"></div>');
    var $loading = $('<div id="loading">正在加载...</div>');
    $('body').append($loadingBg)
      .append($loading);
  }
  function removeLoading() {
    $('#loading-bg').remove();
    $('#loading').remove();
  }
  var CacheService = (function() {
    function CacheService(prefix, version) {
      this.prefix = prefix || '';
      this.version = version || '0.1';
    }
    var proto = CacheService.prototype;
    proto.genKey = function(key) {
      return this.prefix + ':' + key + ':' + this.version;
    };
    proto.get = function(key) {
      var self = this;
      key = self.genKey(key);
      return localStorage.getItem(key);
    };
    proto.set = function(key, value) {
      var self = this;
      key = self.genKey(key);
      return localStorage.setItem(key, value);
    };
    return CacheService;
  })();
  var listCacheService = new CacheService('list', gistListTpl.length + version),
      detailCacheService = new CacheService('detail', gistDetailTpl.length + version),
      fileCacheService = new CacheService('file', gistDetailTpl.length + version);
  function getList(page, cbk) {
    var cache = listCacheService.get(page);
    if (cache) {
      cbk(cache);
    } else {
      addLoading();
    }
    var gistsPromise = getPromise({
      url: 'https://api.github.com/users/' + username + '/gists?page=' + page,
      type: 'GET'
    });
    gistsPromise.done(function(jsn) {
      var render = shani.compile(gistListTpl);
      var html = render({
        gists: jsn.filter(function(item) {
          return !!item.description && !!item.files[filename] && (item.files[filename].language === 'Markdown');
        }),
        filename: filename
      });
      listCacheService.set(page, html);
      cbk(html);
    });
  }
  function getDetail(id, cbk) {
    var justCache = !cbk;
    cbk = cbk || function() {};
    var cache = detailCacheService.get(id);
    if (cache) {
      cbk(cache);
    } else if (!justCache) {
      addLoading();
    }
    function renderData(data) {
      var render = shani.compile(gistDetailTpl);
      var html = render(data);
      detailCacheService.set(id, html);
      return cbk(html);
    }
    var detailPromise = getPromise({
      url: 'https://api.github.com/gists/' + id,
      type: 'GET'
    });
    detailPromise.done(function(jsn) {
      if (!jsn.description || !jsn.files[filename] || (jsn.files[filename].language !== 'Markdown')) {
        console.log('not a Markdown file!!!');
        return;
      }
      var rawUrl = jsn.files[filename].raw_url;
      var key = rawUrl + ':' + (new Date(jsn.updated_at) - 0);
      var _cache = fileCacheService.get(key);
      if (_cache) {
        var data = {
          title: jsn.description,
          content: _cache,
          created_at: jsn.created_at,
          html_url: jsn.html_url
        };
        return renderData(data);
      }
      var filePromise = getPromise({
        url: rawUrl,
        type: 'GET'
      });
      filePromise.done(function(txt) {
        getOtherFileContent(jsn.files, jsn.updated_at, function(acc) {
          var content = marked(txt + '\n\n' + acc.join('\n\n'));
          var data = {
            title: jsn.description,
            content: content,
            created_at: jsn.created_at,
            html_url: jsn.html_url
          };
          fileCacheService.set(key, content);
          renderData(data);
        });
      });
    });
  }
  function getOtherFileContent(files, updatedAt, cbk) {
    var fileNames = Object.keys(files).filter(function(item) {
      return item !== filename;
    });
    var acc = [];
    function done(txt, file, key) {
      if (typeof key === 'string') {
        fileCacheService.set(key, txt);
      }
      acc.push('<div class="file-split"></div><a target="_blank" class="raw-url" href="' + file.raw_url + '">' + file.filename + '</a>\n```' + file.language.toLowerCase() + '\n' + txt + '\n```');
      if (acc.length === fileNames.length) {
        cbk(acc);
      }
    }
    if (!fileNames) return cbk(acc);
    fileNames.forEach(function(fileName, idx) {
      var file = files[fileName];
      var key = file.raw_url + ':' + (new Date(updatedAt) - 0);
      var _cache = fileCacheService.get(key);
      if (_cache) return done(_cache, file, key);
      getPromise({
        url: file.raw_url
      }).done(function(txt) {
        done(txt, file, key);
      });
    });
  }
  function cacheAll() {
    var $gistItemList = $('.gist-item');
    $gistItemList.each(function(_, item) {
      var $item = $(item);
      var id = $item.data('id');
      getDetail(id);
    });
  }
  function homeHandler(request) {
    getList(request.params.page || '1', function(html) {
      if (location.hash !== '') return;
      var $gistList = $main.find('#gist-list');
      if (!$gistList.length) {
        $main.html('<div id="gist-list">' + html + '</div>');
      } else if ($gistList.html() !== html) {
        $gistList.html(html);
      }
      removeLoading();
      cacheAll();
    });
  }
  function blogDetailHandler(request, id) {
    getDetail(id, function(html) {
      if (request.path !== location.hash.slice(1)) return;
      if ($main.html() !== html) {
        $main.html(html);
      }
      removeLoading();
    });
  }
  router(routers);
});
