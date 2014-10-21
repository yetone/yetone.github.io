$(function() {
  var $D = $(document),
      $main = $('#main'),
      username = 'yetone',
      version = '0.2.1',
      gistListTpl = $('#gist-list-tpl').html(),
      gistDetailTpl = $('#gist-detail-tpl').html(),
      listRender = shani.compile(gistListTpl),
      detailRender = shani.compile(gistDetailTpl),
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
  var listCacheService = new CacheService('list', username + gistListTpl.length + version),
      detailCacheService = new CacheService('detail', username + gistDetailTpl.length + version);
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
      var html = listRender({
        gists: jsn.filter(function(item) {
          return !!item.description && !!item.files[filename] && (item.files[filename].language === 'Markdown');
        }),
        filename: filename
      });
      listCacheService.set(page, html);
      cbk(html);
    });
  }
  function getIframes(files) {
    var acc = [];
    for (var key in files) {
      if (!files.hasOwnProperty(key)) continue;
      var file = files[key];
      if (file.language !== 'JSON') continue;
      if (JSON.parse(file.content).type !== 'FeatureCollection') continue;
      acc.push('https://render.githubusercontent.com/view/geojson/?url=' + file.raw_url);
      delete files[key];
    }
    return acc;
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
    var detailPromise = getPromise({
      url: 'https://api.github.com/gists/' + id,
      type: 'GET'
    });
    detailPromise.done(function(jsn) {
      if (!jsn.description || !jsn.files[filename] || (jsn.files[filename].language !== 'Markdown')) {
        console.log('not a Markdown file!!!');
        return;
      }
      var files = jsn.files;
      var mainFile = files[filename];
      delete files[filename];
      var data = {
        title: jsn.description,
        content: mainFile.content,
        created_at: jsn.created_at,
        iframes: getIframes(files),
        files: files,
        html_url: jsn.html_url
      };
      var html = detailRender(data);
      detailCacheService.set(id, html);
      return cbk(html);
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
      if ($main.html() !== html) {
        $main.html(html);
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
