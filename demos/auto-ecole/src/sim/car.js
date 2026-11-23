// Kinematic car model. Units: world pixels, seconds, radians.

export const CAR = {
  maxSpeed: 260,
  accel: 260,
  brake: 420,
  drag: 0.45, // 1/s, caps top speed softly
  steerGain: 3.4, // rad/s at full lock and high speed
  steerSoft: 70, // px/s, below this turning authority fades (like a real car)
  bodyRadius: 7, // collision circle
  length: 18,
  width: 10,
};

export function createCar(pose) {
  return {
    x: pose.x,
    y: pose.y,
    heading: pose.heading,
    speed: 0,
    alive: true,
    // Unwrapped float index along the track centerline (laps accumulate).
    progressIdx: 0,
    progressDist: 0,
    stallTimer: 0,
    stallRefDist: 0,
  };
}

export function driveCar(car, steer, accel, dt) {
  const a = accel >= 0 ? accel * CAR.accel : accel * CAR.brake;
  car.speed += a * dt;
  car.speed -= car.speed * CAR.drag * dt;
  if (car.speed < 0) car.speed = 0;
  else if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;

  const authority = car.speed / (car.speed + CAR.steerSoft);
  car.heading += steer * CAR.steerGain * authority * dt;

  car.x += Math.cos(car.heading) * car.speed * dt;
  car.y += Math.sin(car.heading) * car.speed * dt;
}
