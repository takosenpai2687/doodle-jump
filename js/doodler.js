class Doodler {
    // Image handle
    static leftImage;
    static rightImage;

    // Direction enum
    static Direction = {
        LEFT: 0,
        RIGHT: 1,
    };

    // Collision box dimensions
    static w = 80;
    static h = 80;
    // Vertical jump force
    static jumpForce = 8.15;
    // Vertical spring jump force
    static superJumpForce = 14;
    // Horizontal speed scalar
    static speed = 7.2;

    /**
     * Construct with position
     * Default static
     * Default direction : RIGHT
     * @param {Number} x
     * @param {Number} y
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.direction = Doodler.Direction.RIGHT;
    }

    /**
     * Renders the doodler
     */
    render() {
        // Choose image according to the current direction
        image(
            this.direction === Doodler.Direction.LEFT
                ? Doodler.leftImage
                : Doodler.rightImage,
            this.x - Doodler.w / 2,
            this.y - Doodler.h / 2,
            Doodler.w,
            Doodler.h
        );
    }

    /**
     * Update and move the doodler
     */
    update() {
        // Horizontal move
        this.x += this.vx;
        // Ensure within screen
        if (this.x > width) {
            this.x = 0;
        } else if (this.x < 0) {
            this.x = width;
        }
        // Vertical move
        // Falls faster
        this.vy += this.vy < 0 ? config.GRAVITY : config.GRAVITY * 1.33;
        if (this.vy > config.MAX_FALLING_SPEED)
            this.vy = config.MAX_FALLING_SPEED;
        this.y += this.vy;
        // Ensure below THRESHOLD=100
        if (this.y <= config.THRESHOLD) {
            this.y = config.THRESHOLD;
        }
    }
}
