const mqtt = require('mqtt');
const version = require('./package.json').version;

var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerPlatform('homebridge-dafang-mqtt-republish', 'dafangMqtt', dafangMqtt, true);
}

function dafangMqtt(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;

    this.accessories = [];

    const server = config.server || '127.0.0.1';
    const port = config.port || '1883';
    this.mqttUrl = 'mqtt://' + server + ':' + port;

    if (config.homebridge_topic) {
        if(config.homebridge_topic == 'homebridge/motion') {
            this.homebridge_topic = 'homebridge';
        } else {
            this.homebridge_topic = config.homebridge_topic;
        }
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

    api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
}

dafangMqtt.prototype.configureAccessory = function(accessory) {
    this.log('Configuring accessories for ' + accessory.displayName + '...');

    const config = this.config.cameras.find((camera) => camera.name === accessory.displayName);

    if (!config || !config.accessories) {
        this.accessories.push(accessory);
        return;
    }

    const cameraAccessoryInfo = accessory.getService(Service.AccessoryInformation);
    if (cameraAccessoryInfo) {
        cameraAccessoryInfo.updateCharacteristic(Characteristic.Manufacturer, config.manufacturer || 'Dafang');
        cameraAccessoryInfo.updateCharacteristic(Characteristic.Model, config.model || 'Hacks');
        cameraAccessoryInfo.updateCharacteristic(Characteristic.SerialNumber, config.serialNumber || 'SerialNumber');
        cameraAccessoryInfo.updateCharacteristic(Characteristic.FirmwareRevision, config.firmwareRevision || version);
    }

    let blueLedService = accessory.getServiceById(Service.Lightbulb, '/leds/blue');
    let yellowLedService = accessory.getServiceById(Service.Lightbulb, '/leds/yellow');
    let irLedService = accessory.getServiceById(Service.Lightbulb, '/leds/ir');
    let irCutService = accessory.getServiceById(Service.Switch, '/ir_cut');
    let brightnessService = accessory.getServiceById(Service.LightSensor, '/brightness');
    let nightModeService = accessory.getServiceById(Service.Switch, '/night_mode');
    let motionTrackingService = accessory.getServiceById(Service.Switch, '/motion/tracking');
    let motorsUpService = accessory.getServiceById(Service.Switch, '/motors/vertical/up');
    let motorsDownService = accessory.getServiceById(Service.Switch, '/motors/vertical/down');
    let motorsLeftService = accessory.getServiceById(Service.Switch, '/motors/horizontal/left');
    let motorsRightService = accessory.getServiceById(Service.Switch, '/motors/horizontal/right');
    let recordingService = accessory.getServiceById(Service.Switch, '/recording');
    let snapshotService = accessory.getServiceById(Service.Switch, '/snapshot');

    if (blueLedService) {
        accessory.removeService(blueLedService);
    }
    if (yellowLedService) {
        accessory.removeService(yellowLedService);
    }
    if (irLedService) {
        accessory.removeService(irLedService);
    }
    if (irCutService) {
        accessory.removeService(irCutService);
    }
    if (brightnessService) {
        accessory.removeService(brightnessService);
    }
    if (nightModeService) {
        accessory.removeService(nightModeService);
    }
    if (motionTrackingService) {
        accessory.removeService(motionTrackingService);
    }
    if (motorsUpService) {
        accessory.removeService(motorsUpService);
    }
    if (motorsDownService) {
        accessory.removeService(motorsDownService);
    }
    if (motorsLeftService) {
        accessory.removeService(motorsLeftService);
    }
    if (motorsRightService) {
        accessory.removeService(motorsRightService);
    }
    if (recordingService) {
        accessory.removeService(recordingService);
    }
    if (snapshotService) {
        accessory.removeService(snapshotService);
    }

    if (config.accessories.blueLed) {
        blueLedService = new Service.Lightbulb(config.name + ' Blue LED', '/leds/blue');
        blueLedService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            const message = value ? 'ON' : 'OFF';
            this.publishMqtt(config.dafang_topic + '/leds/blue/set', message);
            callback();
        });
        accessory.addService(blueLedService);
    }
    if (config.accessories.yellowLed) {
        yellowLedService = new Service.Lightbulb(config.name + ' Yellow LED', '/leds/yellow');
        yellowLedService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            const message = value ? 'ON' : 'OFF';
            this.publishMqtt(config.dafang_topic + '/leds/yellow/set', message);
            callback();
        });
        accessory.addService(yellowLedService);
    }
    if (config.accessories.irLed) {
        irLedService = new Service.Lightbulb(config.name + ' IR LED', '/leds/ir');
        irLedService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            const message = value ? 'ON' : 'OFF';
            this.publishMqtt(config.dafang_topic + '/leds/ir/set', message);
            callback();
        });
        accessory.addService(irLedService);
    }
    if (config.accessories.irCut) {
        irCutService = new Service.Switch(config.name + ' IR Filter', '/ir_cut');
        irCutService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            const message = value ? 'ON' : 'OFF';
            this.publishMqtt(config.dafang_topic + '/ir_cut/set', message);
            callback();
        });
        accessory.addService(irCutService);
    }
    if (config.accessories.brightness) {
        brightnessService = new Service.LightSensor(config.name + ' Brightness', '/brightness');
        accessory.addService(brightnessService);
    }
    if (config.accessories.nightMode) {
        nightModeService = new Service.Switch(config.name + ' Night Mode', '/night_mode');
        nightModeService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            const message = value ? 'ON' : 'OFF';
            this.publishMqtt(config.dafang_topic + '/night_mode/set', message);
            callback();
        });
        accessory.addService(nightModeService);
    }
    if (config.accessories.motionTracking) {
        motionTrackingService = new Service.Switch(config.name + ' Motion Tracking', '/motion/tracking');
        motionTrackingService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            const message = value ? 'ON' : 'OFF';
            this.publishMqtt(config.dafang_topic + '/motion/tracking/set', message);
            callback();
        });
        accessory.addService(motionTrackingService);
    }
    if (config.accessories.motorsVertical) {
        motorsUpService = new Service.Switch(config.name + ' Tilt Up', '/motors/vertical/up');
        motorsUpService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            if (value) {
                this.publishMqtt(config.dafang_topic + '/motors/vertical/set', 'up');
                if (value) {
                    setTimeout(() => {
                        motorsUpService.updateCharacteristic(Characteristic.On, false);
                    }, 1000);
                }
            }
            callback();
        });
        accessory.addService(motorsUpService);
        motorsDownService = new Service.Switch(config.name + ' Tilt Down', '/motors/vertical/down');
        motorsDownService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            if (value) {
                this.publishMqtt(config.dafang_topic + '/motors/vertical/set', 'down');
                if (value) {
                    setTimeout(() => {
                        motorsDownService.updateCharacteristic(Characteristic.On, false);
                    }, 1000);
                }
            }
            callback();
        });
        accessory.addService(motorsDownService);
    }
    if (config.accessories.motorsHorizontal) {
        motorsLeftService = new Service.Switch(config.name + ' Pan Left', '/motors/horizontal/left');
        motorsLeftService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            if (value) {
                this.publishMqtt(config.dafang_topic + '/motors/horizontal/set', 'left');
                if (value) {
                    setTimeout(() => {
                        motorsLeftService.updateCharacteristic(Characteristic.On, false);
                    }, 1000);
                }
            }
            callback();
        });
        accessory.addService(motorsLeftService);
        motorsRightService = new Service.Switch(config.name + ' Pan Right', '/motors/horizontal/right');
        motorsRightService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            if (value) {
                this.publishMqtt(config.dafang_topic + '/motors/horizontal/set', 'right');
                if (value) {
                    setTimeout(() => {
                        motorsRightService.updateCharacteristic(Characteristic.On, false);
                    }, 1000);
                }
            }
            callback();
        });
        accessory.addService(motorsRightService);
    }
    if (config.accessories.recording) {
        recordingService = new Service.Switch(config.name + ' Recording', '/recording');
        recordingService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            const message = value ? 'ON' : 'OFF';
            this.publishMqtt(config.dafang_topic + '/recording/set', message);
            callback();
        });
        accessory.addService(recordingService);
    }
    if (config.accessories.snapshot) {
        snapshotService = new Service.Switch(config.name + ' Snapshot', '/snapshot');
        snapshotService.getCharacteristic(Characteristic.On)
        .on('set', (value, callback) => {
            if (value) {
                this.publishMqtt(config.dafang_topic + '/snapshot/set', 'ON');
                if (value) {
                    setTimeout(() => {
                        snapshotService.updateCharacteristic(Characteristic.On, false);
                    }, 1000);
                }
            }
            callback();
        });
        accessory.addService(snapshotService);
    }

    this.accessories.push(accessory);
}

dafangMqtt.prototype.didFinishLaunching = function() {
    this.config.cameras.forEach((camera) => {
        if (camera.accessories) {
            if (!this.accessories.find((acc) => acc.displayName === camera.name)) {
                const uuid = UUIDGen.generate(camera.dafang_topic);
                const accessory = new Accessory(camera.name, uuid);
                this.configureAccessory(accessory);
                this.api.registerPlatformAccessories('homebridge-dafang-mqtt-republish', 'dafangMqtt', [accessory]);
            }
        }
      });
  
      this.accessories.forEach((accessory) => {
        const config = this.config.cameras.find((camera) => camera.name === accessory.displayName)
        if (!config || !config.accessories) {
          this.api.unregisterPlatformAccessories('homebridge-dafang-mqtt-republish', 'dafangMqtt', [accessory]);
        }
      });

    this.connectMqtt();
}

dafangMqtt.prototype.publishMqtt = function(topic, message) {
    this.log.debug('Publishing MQTT Message - ' + topic + ': ' + message);
    this.client.publish(topic, message);
}

dafangMqtt.prototype.parseBoolMsg = function(message) {
    switch (message) {
        case 'ON':
            return true;
        case 'OFF':
            return false;
        default:
            return undefined;
    }
}

dafangMqtt.prototype.handleMotion = function(camera, message) {
    if (this.homebridge_topic) {
        const isOn = this.parseBoolMsg(message);
        if (isOn === undefined) {
            return;
        }
        if (isOn) {
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
}

dafangMqtt.prototype.getService = function(accessory, type, subtype) {
    if (accessory) {
        return accessory.getServiceById(type, subtype);
    } else {
        return undefined;
    }
}

dafangMqtt.prototype.handleBoolService = function(accessory, type, subtype, message) {
    const service = this.getService(accessory, type, subtype);
    if (service) {
        const isOn = this.parseBoolMsg(message);
        if (isOn !== undefined) {
            service.updateCharacteristic(Characteristic.On, isOn);
        }
    }
}

dafangMqtt.prototype.handleBrightness = function(accessory, message) {
    const value = Number.parseInt(message);
    if (Number.isNaN(value)) {
        return;
    }
    const service = this.getService(accessory, Service.LightSensor, '/brightness');
    if (service) {
        const config = this.config.cameras.find((camera) => camera.name === accessory.displayName);
        if (config && config.accessories && config.accessories.brightness)
        {
            switch (config.accessories.brightness) {
                case 'hw':
                    service.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, value);
                    break;
                case 'virtual':
                    service.updateCharacteristic(Characteristic.CurrentAmbientLightLevel, -0.0001 * value + 140);
                    break;
            }
        }
    }
}

dafangMqtt.prototype.connectMqtt = function() {
    this.client = mqtt.connect(this.mqttUrl);
    this.client.on('connect', () => {
        this.log('MQTT Connection Opened');
        this.cameras.forEach(camera => {
            this.client.subscribe(camera.dafang_topic + '/#');
        });
    });
    this.client.on('message', (topic, message) => {
        const msg = message.toString();
        const camera = this.cameras.find(camera => topic.startsWith(camera.dafang_topic));
        const accessory = this.accessories.find((acc) => acc.displayName === camera.name)
        if (camera) {
            const command = topic.substring(camera.dafang_topic.length);
            switch (command) {
                case '/motion':
                    this.handleMotion(camera, message);
                    break;
                case '/leds/blue':
                    this.handleBoolService(accessory, Service.Lightbulb, '/leds/blue', msg);
                    break;
                case '/leds/yellow':
                    this.handleBoolService(accessory, Service.Lightbulb, '/leds/yellow', msg);
                    break;
                case '/leds/ir':
                    this.handleBoolService(accessory, Service.Lightbulb, '/leds/ir', msg);
                    break;
                case '/ir_cut':
                    this.handleBoolService(accessory, Service.Switch, '/ir_cut', msg);
                    break;
                case '/brightness':
                    this.handleBrightness(accessory, msg);
                    break;
                case '/night_mode':
                    this.handleBoolService(accessory, Service.Switch, '/night_mode', msg);
                    break;
                case '/motion/tracking':
                    this.handleBoolService(accessory, Service.Switch, '/motion/tracking', msg);
                    break;
                case '/recording':
                    this.handleBoolService(accessory, Service.Switch, '/recording', msg);
                    break;
            }
        }
    });
}