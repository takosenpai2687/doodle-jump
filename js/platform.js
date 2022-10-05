class Platform {
    // Collision box dimensions
    static w = 110;
    static h = 28;
    // Horizontal speed scalar
    static speed = 2;
    // Spring dimensions
    static springW = 14;
    static springH = 14;
    // Image handle
    static springImage;

    /**
     * Construct with position and type
     * default vx = speed
     * @param {Number} x
     * @param {Number} y
     * @param {Platform.platformTypes} type
     * @param {Boolean} springed
     */
    constructor(x, y, type, springed) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.vx = Platform.speed;
        // Does the platform have a spring on it
        this.springed = springed;
        // Randomly initialize spring position : relative
        if (springed) {
            this.springX = (Math.random() - 0.5) * Platform.w * 0.8;
            this.springY = -Platform.h / 2 - Platform.springH / 2;
        } else {
            this.springX = null;
            this.springY = null;
        }
    }

    /**
     * Renders the platform instance
     */
    render() {
        // Do not draw invisible
        if (this.type === Platform.platformTypes.INVISIBLE) return;
        // Fill middle rect
        noStroke();
        rectMode(RADIUS);
        fill(Platform.platformTypes.getColor(this.type));
        rect(this.x, this.y, Platform.w / 2, Platform.h / 2);
        // Draw rest
        // Left semi circle
        stroke(0);
        strokeWeight(2);
        arc(
            this.x - Platform.w / 2,
            this.y,
            Platform.h,
            Platform.h,
            HALF_PI,
            HALF_PI + PI,
            OPEN
        );
        // Right semi circle
        arc(
            this.x + Platform.w / 2,
            this.y,
            Platform.h,
            Platform.h,
            HALF_PI + PI,
            HALF_PI,
            OPEN
        );

        // Draw top line
        line(
            this.x - Platform.w / 2,
            this.y - Platform.h / 2,
            this.x + Platform.w / 2,
            this.y - Platform.h / 2
        );
        // Draw bottom line
        line(
            this.x - Platform.w / 2,
            this.y + Platform.h / 2,
            this.x + Platform.w / 2,
            this.y + Platform.h / 2
        );
        // Draw spring if applicable
        if (this.springed) {
            image(
                Platform.springImage,
                // hard-coded offsets due to the source image being imcompliant
                this.x + this.springX - Platform.springW / 2 - 11,
                this.y + this.springY - Platform.springH / 2,
                Platform.springW * 2.5,
                Platform.springH * 2
            );
        }
    }

    /**
     * Update the moving platform
     * This method assumes the platform is moving
     * Must check type before calling this function, for better performance
     */
    update() {
        this.x += this.vx;
        if (this.x > width - Platform.w / 2 || this.x < Platform.w / 2) {
            this.vx *= -1;
        }
    }

    /**
     * Static inner class for platformTypes enum and utils
     * Value is the probability of spawn rate out of 10
     */
    static platformTypes = {
        STABLE: 5,
        MOVING: 2,
        FRAGILE: 3,
        INVISIBLE: 0,

        /**
         * Get a random platform type
         * @returns {Platform.platformTypes} platformType
         */
        getRandomType() {
            const rand = Math.random() * 10;
            return rand < this.STABLE
                ? this.STABLE
                : rand < this.STABLE + this.MOVING
                ? this.MOVING
                : this.FRAGILE;
        },

        /**
         * Get the render color of the given platform type
         * @param {Platform.platformTypes} type
         */
        getColor(type) {
            switch (type) {
                case this.STABLE:
                    return color("#8ac43d");
                case this.MOVING:
                    return color("#31b8d6");
                case this.FRAGILE:
                    return color(255);
                default:
                    return null;
            }
        },
    };
}
