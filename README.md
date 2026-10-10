# Vehicle Speedometer Dashboard

A template for a vehicle speedometer dashboard that displays various vehicle metrics including speed, RPM, fuel level, and more.

## Functions Documentation

#### `setEngine(state)`
Updates the display of the engine state.
- **Parameters:**
  - `state` (boolean): If true, the engine is on; otherwise, it is off.

#### `setSpeed(speed)`
Updates the speed display based on the current speed mode.
- **Parameters:**
  - `speed` (number): The speed value in meters per second (m/s).

#### `setRPM(rpm)`
Updates the RPM (Revolutions Per Minute) display.
- **Parameters:**
  - `rpm` (number): The RPM value to display (0 to 1).

#### `setFuel(fuel)`
Updates the fuel level display as a percentage.
- **Parameters:**
  - `fuel` (number): The fuel level (0 to 1).

#### `setHealth(health)`
Updates the vehicle health display as a percentage.
- **Parameters:**
  - `health` (number): The vehicle health level (0 to 1).

#### `setGear(gear)`
Updates the current gear display.
- **Parameters:**
  - `gear` (string|number): The current gear to display (0 represents neutral/reverse).

#### `setHeadlights(state)`
Updates the headlights status display.
- **Parameters:**
  - `state` (number): The headlight state (0: Off, 1: On, 2: High Beam).

#### `setLeftIndicator(state)`
Sets the state of the left turn indicator and updates the display.
- **Parameters:**
  - `state` (boolean): If true, turns the left indicator on; otherwise, turns it off.

#### `setRightIndicator(state)`
Sets the state of the right turn indicator and updates the display.
- **Parameters:**
  - `state` (boolean): If true, turns the right indicator on; otherwise, turns it off.

#### `setSeatbelts(state)`
Updates the seatbelt status display.
- **Parameters:**
  - `state` (boolean): If true, indicates seatbelts are fastened; otherwise, indicates they are not.

#### `setSpeedMode(mode)`
Sets the speed display mode and updates the speed unit display.
- **Parameters:**
  - `mode` (number): The speed mode to set (0: KMH, 1: MPH, 2: Knots).

#### `setOdometer(distance)`
Sets the Odometer value of the Speedometer.
- **Parameters:**
  - `distance` (number): The distance in miles.

## Usage

1. Include the script in your HTML file:
   ```html
   <script src="script.js"></script>
   ```

2. Call the appropriate functions to update the dashboard:
   ```javascript
   setEngine(true);
   setSpeed(25); // 25 m/s
   setRPM(2500);
   setFuel(0.75); // 75% fuel
   setHealth(0.9); // 90% health
   setGear(3);
   setHeadlights(1); // Turn on headlights
   setLeftIndicator(true); // Turn on left indicator
   setSeatbelts(true); // Seatbelts fastened
   setSpeedMode(1); // Set to MPH
   setOdometer(123.4); // 123.4 Miles
   ```

## Dependencies

- Modern web browser with JavaScript enabled
- No external dependencies required
