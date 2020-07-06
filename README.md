# homebridge-dafang-mqtt-republish
[![npm](https://img.shields.io/npm/v/homebridge-dafang-mqtt-republish) ![npm](https://img.shields.io/npm/dt/homebridge-dafang-mqtt-republish)](https://www.npmjs.com/package/homebridge-dafang-mqtt-republish)

This plugin republishes MQTT motion messages from [Dafang Hacks](https://github.com/EliasKotlyar/Xiaomi-Dafang-Hacks) into a format [homebridge-camera-ffmpeg](https://github.com/homebridge-plugins/homebridge-camera-ffmpeg) understands.

Note that this plugin itself does not expose any devices to HomeKit.

### Installation
1. Install Homebridge using the [official instructions](https://github.com/homebridge/homebridge/wiki).
2. Install homebridge-camera-ffmpeg using `sudo npm install -g homebridge-camera-ffmpeg --unsafe-perm`.
3. Install this plugin using `sudo npm install -g homebridge-dafang-mqtt-republish`.
4. Update your configuration file. See configuration sample below.

### Configuration
Edit your `config.json` accordingly. Configuration sample:
 ```
    "platforms": [
        {
            "platform": "dafangMqtt",
            "server": "10.0.1.190",
            "port": 1883,
            "cameras": [
                {
                    "name": "Cat Food Camera",
                    "dafang_topic": "dafang/catcam",
                    "homebridge_topic": "homebridge/motion"
                }
            ]
        }
    ]
```

| Fields               | Description                                                                       | Required |
|----------------------|-----------------------------------------------------------------------------------|----------|
| platform             | Must always be `dafangMqtt`.                                                      | Yes      |
| server               | The address of your MQTT server. (Default: 127.0.0.1)                             | No       |
| port                 | The port of your MQTT server. (Default: 1883)                                     | No       |
| cameras              | Array of Dafang Hacks camera configs (multiple supported).                        | Yes      |
| \|- name             | Name of your camera. (Needs to be the same as in homebridge-camera-ffmpeg config) | Yes      |
| \|- dafang_topic     | MQTT topic that your camera publishes to.                                         | Yes      |
| \|- homebridge_topic | MQTT topic that homebridge-camera-ffmpeg is subscribed to.                        | Yes      |
| \|- cooldown         | Cooldown in seconds. Set to 0 to disable.                                         | No       |
