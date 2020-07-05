# homebridge-dafang-mqtt-republish
[![npm](https://img.shields.io/npm/v/homebridge-dafang-mqtt-republish) ![npm](https://img.shields.io/npm/dt/homebridge-dafang-mqtt-republish)](https://www.npmjs.com/package/homebridge-dafang-mqtt-republish)

This plugin republishes MQTT motion messages from [Dafang Hacks](https://github.com/EliasKotlyar/Xiaomi-Dafang-Hacks) into a format [homebridge-camera-ffmpeg](https://github.com/homebridge-plugins/homebridge-camera-ffmpeg) understands.

Note that this plugin itself does not expose any devices to HomeKit.

### Installation
1. Install homebridge using `npm install -g homebridge`.
2. Install homebridge-camera-ffmpeg using `npm install -g homebridge-camera-ffmpeg`.
2. Install this plugin using `npm install -g homebridge-dafang-mqtt-republish`.
3. Update your configuration file. See configuration sample below.

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
