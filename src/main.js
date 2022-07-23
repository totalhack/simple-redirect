

var COOKIE_PREFIX = '_simpleRedirect_'
var TEST_NAME_PARAM = 'srtn'
var BRANCH_NAME_PARAM = 'srbn'
var DEFAULT_TTL_SECS = 60 * 60 * 24 * 30

var currentUrl = new URL(window.location.href)

// Credit: https://github.com/DavidWells/analytics/blob/master/packages/analytics-util-storage-cookie
function cookie(name, value, ttl, path, samesite, secure, domain) {
  var isSet = arguments.length > 1
  try {
    if (isSet) {
      return document.cookie = name + '=' + encodeURIComponent(value) +
        ((!ttl) ? '' : '; expires=' + new Date(+new Date() + (ttl * 1000)).toUTCString() +
          ((!path) ? '' : '; path=' + path) +
          ((!samesite) ? '' : '; SameSite=' + samesite) +
          ((!domain) ? '' : '; domain=' + domain) +
          ((!secure) ? '' : '; secure'))
    }
    return decodeURIComponent((('; ' + document.cookie).split('; ' + name + '=')[1] || '').split(';')[0])
  } catch (e) {
    console.warn('simple-redirect: cookies unsupported')
    return null
  }
}

function testApplies(test) {
  if (!test.name || !test.urlPattern || !test.redirectTo) {
    console.warn('simple-redirect: invalid test:', test)
    return false
  }
  var re = new RegExp(test.urlPattern)
  if (window.location.href.match(re)) {
    return true
  }
  return false
}

function checkUserBranch(test) {
  var res = cookie(COOKIE_PREFIX + test.name)
  if (!res) {
    return null
  }
  console.debug("Found user branch via cookie")
  return JSON.parse(res)
}

function saveUserBranch(test, branch) {
  var ttl = test.ttl
  if (typeof ttl === 'undefined') {
    ttl = DEFAULT_TTL_SECS
  }
  var path = "/"
  var samesite = 'Strict'
  return cookie(COOKIE_PREFIX + test.name, JSON.stringify(branch), ttl, path, samesite)
}

function mergeSearchParams(url1, url2) {
  // Merge url1 search params onto url2, return url2
  for (const [key, value] of url1.searchParams.entries()) {
    url2.searchParams.set(key, value)
  }
  return url2
}

function pickUserBranch(test) {
  var finalUrl
  var redirect = false
  var weight = test.weight || 0.5

  if (Math.random() < weight) {
    redirect = new URL(test.redirectTo)
    redirect.searchParams.set(TEST_NAME_PARAM, test.name);
    redirect.searchParams.set(BRANCH_NAME_PARAM, "test");
    if (currentUrl.search.length > 0) {
      var tempUrl = mergeSearchParams(redirect, currentUrl)
      redirect.search = tempUrl.search
    }
    finalUrl = redirect.toString()
    redirect = true
  } else {
    currentUrl.searchParams.set(TEST_NAME_PARAM, test.name);
    currentUrl.searchParams.set(BRANCH_NAME_PARAM, "control");
    var newPath = currentUrl.pathname + '?' + currentUrl.searchParams.toString();
    history.pushState(null, '', newPath);
    finalUrl = currentUrl.toString()
  }

  return { redirect: redirect, url: finalUrl }
}

function executeBranch(branch) {
  if (branch.redirect) {
    window.location.href = branch.url;
  }
}

function init() {
  var tests = window.simpleRedirectTests || [];
  tests.forEach(function (test) {
    if (!testApplies(test)) {
      return
    }

    var useCookies = typeof test.cookie === 'undefined' || test.cookie;
    var branch
    if (useCookies) {
      branch = checkUserBranch(test)
    }
    if (!branch) {
      branch = pickUserBranch(test)
    }

    if (useCookies) {
      saveUserBranch(test, branch)
    }
    console.debug("Branch:", branch)
    executeBranch(branch)
  })
}

init()

export default init