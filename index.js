const mqtt = require('mqtt');

module.exports = function(homebridge) {
    homebridge.registerPlatform("homebridge-dafang-mqtt-republish", "dafangMqtt", dafangMqtt, true);
}

function dafangMqtt(log, config, api) {
    this.log = log;
    this.config = config;

    this.cameras = {};
    this.config.cameras.forEach(camera => {
        this.cameras[camera.name] = {};
        this.cameras[camera.name].motion = false;
        this.cameras[camera.name].timer = null;
    });

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
                    this.cameras[camera.name].motion = true;
                    if (!this.cameras[camera.name].timer) {
                        this.log.debug('Publishing MQTT Message - ' + camera.homebridge_topic + ': ' + camera.name);
                        client.publish(camera.homebridge_topic, camera.name);
                    } else {
                        this.log.debug('Motion set received, but cooldown running: ' + camera.name);
                    }
                    if (camera.cooldown > 0) {
                        if (this.cameras[camera.name].timer) {
                            this.log.debug('Cancelling existing cooldown timer: ' + camera.name);
                            clearTimeout(this.cameras[camera.name].timer);
                        }
                        this.log.debug('Cooldown enabled, starting timer: ' + camera.name);
                        this.cameras[camera.name].timer = setTimeout(function() {
                            this.log.debug('Cooldown finished, motion detected = ' + this.cameras[camera.name].motion + ': ' + camera.name);
                            if (!this.cameras[camera.name].motion) {
                                this.log.debug('Publishing MQTT Message - ' + camera.homebridge_topic + '/reset: ' + camera.name);
                                client.publish(camera.homebridge_topic + '/reset', camera.name);
                            }
                            this.cameras[camera.name].timer = null;
                        }.bind(this), camera.cooldown * 1000);
                    }
                } else if (msg == 'OFF') {
                    this.cameras[camera.name].motion = false;
                    if (!this.cameras[camera.name].timer) {
                        this.log.debug('Publishing MQTT Message - ' + camera.homebridge_topic + '/reset: ' + camera.name);
                        client.publish(camera.homebridge_topic + '/reset', camera.name);
                    } else {
                        this.log.debug('Motion clear received, but cooldown running: ' + camera.name);
                    }
                }
            }
        });
    });
}