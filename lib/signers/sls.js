var ALY = require('../core');
var inherit = ALY.util.inherit;

/**
 * @api private
 */
ALY.Signers.SLS = inherit(ALY.Signers.RequestSigner, {
  /**
   * When building the stringToSign, these sub resource params should be
   * part of the canonical resource string with their NON-decoded values
   */
  subResources: {
    'acl': 1,
    'cors': 1,
    'lifecycle': 1,
    'delete': 1,
    'location': 1,
    'logging': 1,
    'notification': 1,
    'partNumber': 1,
    'policy': 1,
    'requestPayment': 1,
    'restore': 1,
    'tagging': 1,
    'torrent': 1,
    'uploadId': 1,
    'uploads': 1,
    'versionId': 1,
    'versioning': 1,
    'versions': 1,
    'website': 1
  },

  // when building the stringToSign, these querystring params should be
  // part of the canonical resource string with their NON-encoded values
  responseHeaders: {
    'response-content-type': 1,
    'response-content-language': 1,
    'response-expires': 1,
    'response-cache-control': 1,
    'response-content-disposition': 1,
    'response-content-encoding': 1
  },

  addAuthorization: function addAuthorization(credentials, date) {
    this.request.headers['Date'] = ALY.util.date.rfc822(date);

    var signature = this.sign(credentials.secretAccessKey, this.stringToSign());
    var auth = 'SLS ' + credentials.accessKeyId + ':' + signature;

    this.request.headers['Authorization'] = auth;
  },

  stringToSign: function stringToSign() {
    var r = this.request;

    var parts = [];
    parts.push(r.method);
    parts.push(r.headers['Content-MD5'] || '');
    parts.push(r.headers['Content-Type'] || '');

    // This is the "Date" header, but we use X-Amz-Date.
    // The S3 signing mechanism requires us to pass an empty
    // string for this Date header regardless.
    // this works:
    // getSignedUrl use 'presigned-expires'
    // other request use 'Date'
    parts.push(r.headers['Date'] || '');

    var headers = this.canonicalizedAmzHeaders();
    if (headers) parts.push(headers);
    parts.push(this.canonicalizedResource());

    return parts.join('\n');

  },

  canonicalizedAmzHeaders: function canonicalizedAmzHeaders() {

    var amzHeaders = [];

    ALY.util.each(this.request.headers, function (name) {
      if (name.match(/^x-sls-/i))
        amzHeaders.push(name);
    });

    amzHeaders.sort(function (a, b) {
      return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
    });

    var parts = [];
    ALY.util.arrayEach.call(this, amzHeaders, function (name) {
      parts.push(name.toLowerCase() + ':' + String(this.request.headers[name]));
    });

    return parts.join('\n');

  },

  canonicalizedResource: function canonicalizedResource() {

    var r = this.request;

    var parts = r.path.split('?');
    var path = parts[0];
    var querystring = parts[1];

    var resource = '';

    if (r.virtualHostedBucket)
      resource += '/' + r.virtualHostedBucket;

    resource += decodeURIComponent(path);

    if (querystring) {

      // collect a list of sub resources and query params that need to be signed
      var resources = [];

      ALY.util.arrayEach.call(this, querystring.split('&'), function (param) {
        var name = param.split('=')[0];
        var value = param.split('=')[1];
        /*jshint undef:false */
        if (this.subResources[name] || this.responseHeaders[name]) {
          var resource = { name: name };
          if (value !== undefined) {
            if (this.subResources[name]) {
              resource.value = value;
            } else {
              resource.value = decodeURIComponent(value);
            }
          }
          resources.push(resource);
        }
      });

      resources.sort(function (a, b) { return a.name < b.name ? -1 : 1; });

      if (resources.length) {

        querystring = [];
        ALY.util.arrayEach(resources, function (resource) {
          if (resource.value === undefined)
            querystring.push(resource.name);
          else
            querystring.push(resource.name + '=' + resource.value);
        });

        resource += '?' + querystring.join('&');
      }

    }

    return resource;

  },

  sign: function sign(secret, string) {
    if(process.env.DEBUG) {
      console.log('----------- sign string start -----------');
      console.log(string);
      console.log('----------- sign string end -----------');
    }
    return ALY.util.crypto.hmac(secret, string, 'base64', 'sha1');
  }
});

module.exports = ALY.Signers.SLS;
