var net = require('net'),
    sys = require('sys');

function Server() {
}

Server.hostname = "localhost";
Server.port = 1025;
Server.address = "0.0.0.0";

function Client(stream) {
  this.stream = stream;
  this.inData = false;

  this.name = "";
  this.reset();
}

Client.prototype.send = function(code, message) {
  if (this.stream.readyState !== "open" && this.stream.readyState !== "writeOnly") {
    return false;
  }

  try {
    this.stream.write(''+code);
    if (message) this.stream.write(' '+message);
    this.stream.write('\r\n');
  } catch (e) {
    // Ignore
  }
};

/**
 * Sends a banner to the client
 * Besides 220, there is also 421 (too busy)
 */
Client.prototype.banner = function () {
  this.send(220, Server.hostname+' ESMTP smtpd');
};

Client.prototype.quit = function (why) {
  try {
    this.send(221, ' goodbye - '+why);
  } catch(e) {
    // Ignore
  }
};

Client.prototype.error = function (why) {
  this.send(500, why);
};

Client.prototype.addData = function (data) {
  var size = data.length-1;
  if (data == '.') {
    this.inData = false;
    this.sendMessage();
  }
  this.envelope.data.push(data);
};

Client.prototype.reset = function () {
  this.envelope = {
    from: '',
    to: '',
    data: []
  };
};

Client.prototype.sendMessage = function () {
  console.log("Message:");
  console.log(sys.inspect(this.envelope));
  console.log("--------");
  this.send(250, 'ok');
  this.reset();
};

Client.prototype.parse = function(line) {
  var match = /^(\w+)\s*(.*)$/.exec(line);
  if(!match) {
    console.log("Parse error" + sys.inspect(line));
    return;
  } else {
    console.log(line);
  }
  var cmd = match[1];
  var rest = match[2];

  switch (cmd) {
    case "HELO":
      this.name = rest;
      this.send(250, 'ok');
      break;
    case "EHLO":
      this.name = rest;
      this.send(250, 'ok');
      break;
    case "RSET":
      this.reset();
      this.send(250, 'ok');
      break;
    case "NOOP":
      this.send(250, 'ok');
      break;
    case "MAIL":
      match = /^FROM:(.*)$/.exec(rest);
      if (!match) {
        this.error();
        return;
      }
      this.envelope.from = match[1];
      this.send(250, 'ok');
      break;
    case "RCPT":
      match = /^TO:(.*)$/.exec(rest);
      if (!match) {
        this.error();
        return;
      }
      this.envelope.to = match[1];
      this.send(250, 'ok');
      break;
    case "DATA":
      if (this.envelope.from && this.envelope.to) {
        this.inData = true;
        this.send(354, 'ok');
      } else {
        this.send(503, 'need RCPT and MAIL before DATA');
      }
      break;
    case "VRFY":
      break; 
    case "QUIT":
      this.quit("quit");
      break;
    default:
      this.error("Unrecognized command");
      break;
  };

};

var server = net.createServer(function (stream) {
  var client = new Client(stream);
  var buffer = "";

  stream.setEncoding('utf8');
  stream.on('connect', function () {
    client.banner();
  });
  stream.on('data', function (data) {
    var i;

    buffer += data;
    while ((i = buffer.indexOf('\r\n')) != -1) {
      if (i < 0) break;
      var cmd = buffer.slice(0,i);
      if (client.inData) {
        client.addData(cmd);
      } else {
        client.parse(cmd);
      }
      buffer = buffer.slice(i+2);
    }
  });
  stream.on('timeout', function () {
    client.quit("timeout");
  });
  stream.on('end', function () {
    // do nothing
  });
  stream.on('error', function (e) {
    console.log("error:"+e);
  });
});
server.listen(Server.port, Server.address);

