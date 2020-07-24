const mqtt = require('mqtt');

module.exports = function(homebridge) {
    homebridge.registerPlatform('homebridge-dafang-mqtt-republish', 'dafangMqtt', dafangMqtt, true);
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
            this.log.warn('WARNING: No name set for this camera. It will not work unless this is corrected.');
            error = true;
        }

        if (!newCamera.dafang_topic) {
            this.log.warn('WARNING: No topic set for this camera. It will not work unless this is corrected.');
            error = true;
        }

        if (this.cameras.find(camera => camera.name === newCamera.name)) {
            this.log.warn('WARNING: Multiple cameras named "' + newCamera.name + '" configured. Only the first loaded will function.');
            error = true;
        }
        if (this.cameras.find(camera => camera.dafang_topic === newCamera.dafang_topic)) {
            this.log.warn('WARNING: Multiple cameras with topic "' + newCamera.dafang_topic + '" configured. Only the first loaded will function.');
            error = true;
        }

        if (!error) {
            this.cameras.push(newCamera);
        } else {
            this.log.warn('There was error with the config so this camera was ignored.')
        }
    });

    api.on('didFinishLaunching', this.connectMqtt.bind(this));
}

dafangMqtt.prototype.publishMqtt = function(topic, message) {
    this.log.debug('Publishing MQTT Message - ' + topic + ': ' + message);
    this.client.publish(topic, message);
}

dafangMqtt.prototype.parseMsg = function(message) {
    switch (message) {
        case 'ON':
            return true;
        case 'OFF':
            return false;
        default:
            return undefined;
    }
}

dafangMqtt.prototype.handleMotion = function(camera, bool) {
    if (bool) {
        camera.motion = true;
        if (!camera.timer) {
            this.publishMqtt(this.homebridge_topic + '/motion', camera.name);
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
                    this.publishMqtt(this.homebridge_topic + '/motion/reset', camera.name);
                }
                camera.timer = null;
            }.bind(this), camera.cooldown * 1000);
        }
    } else {
        camera.motion = false;
        if (!camera.timer) {
            this.publishMqtt(this.homebridge_topic + '/motion/reset', camera.name);
        } else {
            this.log.debug('Motion clear received, but cooldown running: ' + camera.name);
        }
    }
}

dafangMqtt.prototype.connectMqtt = function() {
    this.client = mqtt.connect(this.mqttUrl);
    this.client.on('connect', () => {
        this.log('MQTT Connection Opened');
        this.log.debug('Clearing motion for all cameras...');
        this.cameras.forEach(camera => {
            this.client.subscribe(camera.dafang_topic + '/#');
            this.publishMqtt(this.homebridge_topic + '/reset', camera.name);
        });
    });
    this.client.on('message', (topic, message) => {
        const msg = message.toString();
        this.log.debug('Received MQTT Message - ' + topic + ': ' + msg);
        const camera = this.cameras.find(camera => topic.startsWith(camera.dafang_topic));
        if (camera) {
            const command = topic.substring(camera.dafang_topic.length + 1);
            const bool = this.parseMsg(msg);
            if (bool !== undefined) {
                switch (command) {
                    case 'motion':
                        this.handleMotion(camera, bool);
                        break;
                }
            }
        }
    });
}