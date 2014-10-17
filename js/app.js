$(function() {
  var $D = $(document),
      $main = $('#main'),
      version = '0.1.1',
      gistListTpl = $('#gist-list-tpl').html(),
      gistDetailTpl = $('#gist-detail-tpl').html(),
      routers = [
        [/^\/blog\/([^\/]*)/, blogDetailHandler],
        [/^\/$/, homeHandler]
      ];
  marked.setOptions({
    highlight: function (code) {
      return hljs.highlightAuto(code).value;
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
    }
    proto.get = function(key) {
      var self = this;
      var key = self.genKey(key);
      return localStorage.getItem(key);
    };
    proto.set = function(key, value) {
      var self = this;
      var key = self.genKey(key);
      return localStorage.setItem(key, value);
    };
    return CacheService;
  })();
  var listCacheService = new CacheService('list', new Date() - 0),
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
      url: 'https://api.github.com/users/yetone/gists?page=' + page,
      type: 'GET'
    });
    gistsPromise.done(function(jsn) {
      var render = shani.compile(gistListTpl);
      var html = render({
        gists: jsn.filter(function(item) {
          return !!item.description && !!item.files['gistfile1.md'] && (item.files['gistfile1.md'].language === 'Markdown');
        })
      });
      listCacheService.set(page, html);
      cbk(html);
    });
  }
  function getDetail(id, cbk) {
    cbk = cbk || function() {};
    var cache = detailCacheService.get(id);
    if (cache) {
      cbk(cache);
    } else {
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
      if (!jsn.description || !jsn.files['gistfile1.md'] || (jsn.files['gistfile1.md'].language !== 'Markdown')) {
        console.log('not a Markdown file!!!');
        return;
      }
      var rawUrl = jsn.files['gistfile1.md'].raw_url;
      var key = rawUrl + ':' + (new Date(jsn.updated_at) - 0);
      var _cache = fileCacheService.get(key);
      if (_cache) {
        var data = {
          title: jsn.description,
          content: _cache,
          created_at: jsn.created_at
        };
        return renderData(data);
      }
      var filePromise = getPromise({
        url: rawUrl,
        type: 'GET'
      });
      filePromise.done(function(txt) {
        var content = marked(txt);
        var data = {
          title: jsn.description,
          content: content,
          created_at: jsn.created_at
        };
        fileCacheService.set(key, content);
        renderData(data);
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
      var $gistList = $main.find('#gist-list');
      if (!$gistList.length) {
        $main.html('<div id="gist-list">' + html + '</div>');
      } else {
        $gistList.html(html);
      }
      removeLoading();
      cacheAll();
    });
  }
  function blogDetailHandler(request, id) {
    getDetail(id, function(html) {
      $main.html(html);
      removeLoading();
    });
  }
  router(routers);
});
