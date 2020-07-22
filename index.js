const mqtt = require('mqtt');

module.exports = function(homebridge) {
    homebridge.registerPlatform("homebridge-dafang-mqtt-republish", "dafangMqtt", dafangMqtt, true);
}

function dafangMqtt(log, config, api) {
    this.log = log;

    const server = config.server || '127.0.0.1';
    const port = config.port || '1883';
    this.mqttUrl = 'mqtt://' + server + ':' + port;

    this.homebridge_topic = 'homebridge';
    if (config.homebridge_topic && config.homebridge_topic != 'homebridge/motion') {
      mqtttopic = config.homebridge_topic;
    }

    const cameraConfigs = config.cameras || [];

    if (cameraConfigs.length == 0) {
        this.log.error('WARNING: No cameras configured.');
    }

    this.cameras = [];
    cameraConfigs.forEach(camera => {
        var newCamera = {};
        newCamera.name = camera.name;
        newCamera.dafang_topic = camera.dafang_topic;
        newCamera.cooldown = camera.cooldown || 0;
        newCamera.motion = false;
        newCamera.timer = null;

        this.log.info('Configuring "' + newCamera.name + '" on topic "' + newCamera.dafang_topic + '" with ' + (newCamera.cooldown > 0 ? newCamera.cooldown + ' second' : 'no') + ' cooldown.');

        var error = false;

        if (!newCamera.name) {
            this.log.error('WARNING: No name set for this camera. It will not work unless this is corrected.');
            error = true;
        }

        if (!newCamera.dafang_topic) {
            this.log.error('WARNING: No topic set for this camera. It will not work unless this is corrected.');
            error = true;
        }

        if (this.cameras.find(camera => camera.name === newCamera.name)) {
            this.log.error('WARNING: Multiple cameras named "' + newCamera.name + '" configured. Only the first loaded will function.');
            error = true;
        }
        if (this.cameras.find(camera => camera.dafang_topic === newCamera.dafang_topic)) {
            this.log.error('WARNING: Multiple cameras with topic "' + newCamera.dafang_topic + '" configured. Only the first loaded will function.');
            error = true;
        }

        if (!error) {
            this.cameras.push(newCamera);
        } else {
            this.log.debug('There was error with the config so this camera was ignored.')
        }
    });

    if (api) {
        api.on('didFinishLaunching', this.connectMqtt.bind(this));
    }
}

dafangMqtt.prototype.connectMqtt = function connectMqtt() {
    const client = mqtt.connect(this.mqttUrl);
    client.on('connect', () => {
        this.log('MQTT Connection Opened');
        this.log.debug('Clearing motion for all cameras...');
        this.cameras.forEach(camera => {
            client.subscribe(camera.dafang_topic + '/motion');
            this.log.debug('Publishing MQTT Message - ' + this.homebridge_topic + '/reset: ' + camera.name);
            client.publish(this.homebridge_topic + '/reset', camera.name);
        });
    });
    client.on('message', (topic, message) => {
        const msg = message.toString();
        this.log.debug('Received MQTT Message - ' + topic + ': ' + msg);
        const camera = this.cameras.find(camera => topic === camera.dafang_topic + '/motion');
        if (camera) {
            if (msg == 'ON') {
                camera.motion = true;
                if (!camera.timer) {
                    this.log.debug('Publishing MQTT Message - ' + this.homebridge_topic + ': ' + camera.name);
                    client.publish(this.homebridge_topic, camera.name);
                } else {
                    this.log.debug('Motion set received, but cooldown running: ' + camera.name);
                }
                if (camera.cooldown > 0) {
                    if (camera.timer) {
                        this.log.debug('Cancelling existing cooldown timer: ' + camera.name);
                        clearTimeout(camera.timer);
                    }
                    this.log.debug('Cooldown enabled, starting timer: ' + camera.name);
                    camera.timer = setTimeout(function() {
                        this.log.debug('Cooldown finished, motion detected = ' + camera.motion + ': ' + camera.name);
                        if (!camera.motion) {
                            this.log.debug('Publishing MQTT Message - ' + this.homebridge_topic + '/reset: ' + camera.name);
                            client.publish(this.homebridge_topic + '/reset', camera.name);
                        }
                        camera.timer = null;
                    }.bind(this), camera.cooldown * 1000);
                }
            } else if (msg == 'OFF') {
                camera.motion = false;
                if (!camera.timer) {
                    this.log.debug('Publishing MQTT Message - ' + this.homebridge_topic + '/reset: ' + camera.name);
                    client.publish(this.homebridge_topic + '/reset', camera.name);
                } else {
                    this.log.debug('Motion clear received, but cooldown running: ' + camera.name);
                }
            }
        }
    });
}