# HomeTemperatureMonitoring

### What is this project about?
 - Provides a simple temperature logger that grabs data from two APIs - one publicly available to get external temperature and one private (running on ESP8266) that provides internal temperature.

#### Internal temperature
 - Internal temperature is provided from ESP8266 via One Wire interface (*DS18B20 temperature probe in this case*)
   - DS18B20 info - measures temperatures from -55°C to +125°C | with ±0.5°C accuracy from -10°C to +85°C
   Wiring diagram:
![wiring diagram](/HomeTempMonitoringScheme.png)
 - Simple server written in C++ provides a very basic frontend to show current measured temperature [in both Fahrenheit and Celsius] and a /temperaturec endpoint to provide a temp. in degree Celsius
   
