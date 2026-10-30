// CloudFront Function (runtime cloudfront-js-2.0, viewer request) for both distributions.
// It routes like docker/nginx.conf: /en and /pt redirect to /en/ and /pt/, an extension-less
// path under a locale (/pt/, /pt/assistant) is that locale's index.html, and files pass through,
// so a missing asset still gets the distribution's error response. Setup: DEPLOYMENT.md.
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  var bare = /^\/(en|pt)$/.exec(uri);
  if (bare) {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: { location: { value: "/" + bare[1] + "/" } }
    };
  }

  var route = /^\/(en|pt)\/(.*)$/.exec(uri);
  if (route && !/\.[A-Za-z0-9]+$/.test(route[2])) {
    request.uri = "/" + route[1] + "/index.html";
  }
  return request;
}
