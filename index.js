const mqtt = require('mqtt');

module.exports = function(homebridge) {
    homebridge.registerPlatform("homebridge-dafang-mqtt-republish", "dafangMqtt", dafangMqtt, true);
}

function dafangMqtt(log, config, api) {
    this.log = log;
    this.config = config;

    if (api) {
        this.api = api;
        this.api.on('didFinishLaunching', this.connectMqtt.bind(this));
    }
}

dafangMqtt.prototype.connectMqtt = function() {
    const server = this.config.server || '127.0.0.1';
    const port = this.config.port || '1883';
    const client = mqtt.connect('mqtt://' + server + ':' + port);
    client.on('connect', () => {
        this.log('MQTT Connection Opened');
        this.config.cameras.forEach(camera => {
            client.subscribe(camera.dafang_topic + '/motion');
        });
    });
    client.on('message', (topic, message) => {
        const msg = message.toString();
        this.log.debug('Received MQTT Message - ' + topic + ': ' + msg);
        this.config.cameras.forEach(camera => {
            if (camera.dafang_topic + '/motion' == topic) {
                if (msg == 'ON') {
                    this.log.debug('Publishing MQTT Message - ' + camera.homebridge_topic + ': ' + camera.name);
                    client.publish(camera.homebridge_topic, camera.name);
                } else if (msg == 'OFF') {
                    this.log.debug('Publishing MQTT Message - ' + camera.homebridge_topic + '/reset: ' + camera.name);
                    client.publish(camera.homebridge_topic + '/reset', camera.name);
                }
            }
        });
    });
}