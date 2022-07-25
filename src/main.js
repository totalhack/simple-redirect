var COOKIE_PREFIX = '_simpleRedirect_'
var TEST_NAME_PARAM = 'srtn'
var BRANCH_NAME_PARAM = 'srbn'
var FORCE_BRANCH_PARAM = 'srfb'
var CONTROL_BRANCH_NAME = 'control'
var TEST_BRANCH_NAME = 'test'
var DEFAULT_TTL_SECS = 60 * 60 * 24 * 30

var currentUrl = new URL(window.location.href)

// Credit: https://github.com/DavidWells/analytics/blob/master/packages/analytics-util-storage-cookie
function cookie(name, value, ttl, path, samesite, secure, domain) {
  name = name.replace(/\s/g, "_") // No whitespace in cookie name
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
    console.warn('cookies unsupported')
    return null
  }
}

function testApplies(test) {
  if (!test.name || !test.urlPattern || !test.redirectTo) {
    console.warn('invalid test:', test)
    return false
  }

  if (currentUrl.searchParams.get(TEST_NAME_PARAM) === test.name) {
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
  var res = JSON.parse(res)
  console.debug("Found branch via cookie")
  return res.branch
}

function saveUserBranch(test, branch) {
  var ttl = test.ttl
  if (typeof ttl === 'undefined') {
    ttl = DEFAULT_TTL_SECS
  }
  var path = "/"
  var samesite = 'Strict'
  var res = { test, branch }
  return cookie(COOKIE_PREFIX + test.name, JSON.stringify(res), ttl, path, samesite)
}

function mergeSearchParams(url1, url2) {
  // Merge url1 search params onto url2, return url2
  for (const [key, value] of url1.searchParams.entries()) {
    url2.searchParams.set(key, value)
  }
  return url2
}

function pickUserBranch(test, forcedBranch) {
  var branch = CONTROL_BRANCH_NAME
  var weight = test.weight || 0.5

  if (forcedBranch === CONTROL_BRANCH_NAME) {
    return CONTROL_BRANCH_NAME
  } else if (forcedBranch === TEST_BRANCH_NAME) {
    return TEST_BRANCH_NAME
  } else if (forcedBranch) {
    console.warn('Ignoring invalid forced branch:', forcedBranch)
  }

  if (Math.random() < weight) {
    branch = TEST_BRANCH_NAME
  }
  return branch
}

function executeBranch(test, branch) {
  if (branch === TEST_BRANCH_NAME) {
    var redirectUrl
    if (!test.redirectTo.startsWith('http')) {
      redirectUrl = new URL(test.redirectTo, currentUrl.origin) // relative url
    } else {
      redirectUrl = new URL(test.redirectTo)
    }

    redirectUrl.searchParams.set(TEST_NAME_PARAM, test.name);
    redirectUrl.searchParams.set(BRANCH_NAME_PARAM, TEST_BRANCH_NAME);
    if (currentUrl.search.length > 0) {
      var tempUrl = mergeSearchParams(redirectUrl, currentUrl)
      redirectUrl.search = tempUrl.search
    }

    window.location.replace(redirectUrl.toString())
  } else if (branch === CONTROL_BRANCH_NAME) {
    currentUrl.searchParams.set(TEST_NAME_PARAM, test.name);
    currentUrl.searchParams.set(BRANCH_NAME_PARAM, CONTROL_BRANCH_NAME);

    window.history.replaceState(null, '', currentUrl.toString());
  } else {
    throw ("Invalid branch: " + branch)
  }
}

function invalidUseAgent() {
  var ua = navigator.userAgent || ''
  var patterns = ['AdsBot-Google', 'Googlebot', 'bingbot']
  for (const pattern of patterns) {
    if (ua.indexOf(pattern) > -1) {
      return true
    }
  }
  return false
}

function init() {
  var tests = window.simpleRedirectTests || [];

  if (invalidUseAgent()) {
    return
  }

  tests.forEach(function (test) {
    if (!testApplies(test)) {
      return
    }

    var forcedBranch = currentUrl.searchParams.get(FORCE_BRANCH_PARAM)
    var useCookies = (typeof test.cookie === 'undefined' || test.cookie);
    var branch

    if (useCookies && !forcedBranch) {
      branch = checkUserBranch(test)
    }

    if (!branch) {
      branch = pickUserBranch(test, forcedBranch)
    }

    if (useCookies) {
      saveUserBranch(test, branch)
    }
    console.debug('Branch:', branch, 'Test:', test)
    executeBranch(test, branch)
  })
}

init()

export default init