class Blackhole {
  static blackholeImg;
  static w = 40;
  static h = 40;
  // Minimum safe distance near blackhole
  static ROCHE_LIMIT = Blackhole.h * 0.75;

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
  }

  render() {
    image(
      Blackhole.blackholeImg,
      this.x - Blackhole.w / 2,
      this.y - Blackhole.h / 2,
      Blackhole.w,
      Blackhole.h
    );
  }
}
