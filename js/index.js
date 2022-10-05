/**
 * Global variables
 */
// All platforms
var platforms = [];
// Doodler Object ref
var doodler;
// Blackhole
var blackhole;
// Pause handle
var paused = false;
// Score
var score = 0;
// Game Over
var isOver = false;
// Is dead from blackhole
var isBlackholed = false;
// Vertical distance between adjacent platforms
var stepSize;
// Mobile detection
var isMobile;
// Background grid cell size
var cell;

const sound = {
    blackhole: null,
    jump: null,
    spring: null,
    fragile: null,
    falling: null,
};

/**
 * Preload event hook
 * For loading static resources before setup
 */
function preload() {
    const isLocalHost =
        location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const baseUrl = isLocalHost
        ? ".."
        : "https://takosenpai2687.github.io/doodlejump";
    Doodler.leftImage = loadImage(baseUrl + "/assets/img/doodler_left.png");
    Doodler.rightImage = loadImage(baseUrl + "/assets/img/doodler_right.png");
    Platform.springImage = loadImage(baseUrl + "/assets/img/spring.png");
    Blackhole.blackholeImg = loadImage(baseUrl + "/assets/img/hole.png");
    soundFormats("mp3", "wav");
    sound.blackhole = loadSound(baseUrl + "/assets/sound/blackhole.mp3");
    sound.jump = loadSound(baseUrl + "/assets/sound/jump.wav");
    sound.spring = loadSound(baseUrl + "/assets/sound/spring.mp3");
    sound.fragile = loadSound(baseUrl + "/assets/sound/fragile.mp3");
    sound.falling = loadSound(baseUrl + "/assets/sound/falling.mp3");
}

/**
 * Setup event hook
 * Initialization
 */
function setup() {
    frameRate(config.FPS);
    createCanvas(windowWidth, windowHeight);
    windowResized();
    generatePlatforms();
    doodler = new Doodler(
        platforms[platforms.length - 2].x,
        platforms[platforms.length - 2].y - Doodler.h / 2 - Platform.h / 2
    );
}

/**
 * Update method of main loop, calls FPS=100 times per second
 */
function draw() {
    // Draw background
    drawBackground();
    // Render blackhole
    blackhole && blackhole.render();
    // Draw all platforms
    platforms.forEach((plat) => {
        plat.render();
        // For springs : check Collision with the falling doodler
        if (
            plat.springed &&
            doodler.vy > 0 &&
            checkCollision(doodler, {
                x: plat.x + plat.springX,
                y: plat.y + plat.springY,
                w: Platform.springW,
                h: Platform.springH,
            })
        ) {
            sound.spring.play();
            doodler.vy = -Doodler.superJumpForce;
        }
        // For non-invisible platforms : check collision with the falling doodler
        if (
            plat.type !== Platform.platformTypes.INVISIBLE &&
            doodler.vy > 0 &&
            checkCollision(doodler, plat)
        ) {
            // Jump on the platform
            doodler.vy = -Doodler.jumpForce;
            // Fragile platforms become invisible after jump
            // Also loses spring
            if (plat.type === Platform.platformTypes.FRAGILE) {
                plat.type = Platform.platformTypes.INVISIBLE;
                plat.springed = false;
                sound.fragile.play();
            } else {
                sound.jump.play();
            }
        }
        // Update moving platforms and blackholes
        if (plat.type === Platform.platformTypes.MOVING && !paused) {
            plat.update();
        }
    });
    // Draw score
    drawScore();
    if (!isOver) {
        // Render the doodler
        doodler.render();
        doodler.update();
        // check death from falling
        if (doodler.y >= height) {
            isOver = true;
            doodler.vx = 0;
            doodler.vy = 0;
            sound.falling.play();
        } else if (
            // check death from blackhole
            blackhole &&
            dist(doodler.x, doodler.y, blackhole.x, blackhole.y) <
                Blackhole.ROCHE_LIMIT
        ) {
            isOver = true;
            doodler.vx = 0;
            doodler.vy = 0;
            doodler.x = blackhole.x;
            doodler.y = blackhole.y;
            isBlackholed = true;
            sound.blackhole.play();
        }
        // check blackhole out of bounds
        if (blackhole && blackhole.y > height) {
            blackhole = null;
        }
        // Restrain doodler from going up above the THRESHOLD=100
        if (doodler.y <= config.THRESHOLD && doodler.vy < 0) {
            // If so, move blackhole and all other platforms down
            // opposite speed of doodler
            blackhole && (blackhole.y -= doodler.vy);
            updatePlatforms();
        }
    } else {
        drawDead();
    }
}

/**
 * Update platforms in response to doodler movement
 */
function updatePlatforms() {
    platforms.forEach((plat, i) => {
        plat.y -= doodler.vy;
        // Gain score
        score++;
        // re-render the bottom non-fragile & non-invisible platform to the top
        // reset position and type
        if (plat.y > height) {
            if (
                plat.type !== Platform.platformTypes.FRAGILE &&
                plat.type !== Platform.platformTypes.INVISIBLE
            ) {
                // Random  x
                let x = Platform.w / 2 + (width - Platform.w) * Math.random();
                // One screen height off for y
                let y = plat.y - (config.STEPS + 1) * stepSize;
                // Random type
                let type = Platform.platformTypes.getRandomType();
                // Random springed
                let springed = Math.random() < config.SPRINGED_CHANCE;
                // Remove current
                platforms.splice(i, 1);
                // Add new
                platforms.push(new Platform(x, y, type, springed));
                // If got a fragile one, go add another stable one aside
                // In case player have nowhere to go
                if (type === Platform.platformTypes.FRAGILE) {
                    // 1/3 offset for the x
                    x = (x + width / 3) % width;
                    // Stable type
                    type = Platform.platformTypes.STABLE;
                    // Random springed
                    springed = Math.random() < config.SPRINGED_CHANCE;
                    // add stable next to the fragile
                    platforms.push(new Platform(x, y, type, springed));
                }
                // for other types there's a chance to generate blackhole
                else if (
                    !blackhole &&
                    Math.random() < config.BLACKHOLE_CHANCE
                ) {
                    blackhole = new Blackhole((x + width / 2) % width, y);
                }
            } else {
                // Fragile & Invisible just remove
                platforms.splice(i, 1);
            }
        }
    });
}

/**
 * KeyPressed event hook
 * Sets doodler speed and direction
 */
function keyPressed() {
    if (isOver) return;
    if (
        (keyCode === LEFT_ARROW || keyCode === 65) &&
        doodler.vx !== -Doodler.speed
    ) {
        doodler.vx = -Doodler.speed;
        doodler.direction = Doodler.Direction.LEFT;
    } else if (
        (keyCode === RIGHT_ARROW || keyCode === 68) &&
        doodler.vx !== Doodler.speed
    ) {
        doodler.vx = Doodler.speed;
        doodler.direction = Doodler.Direction.RIGHT;
    }
}

/**
 * Keyreleased event hook
 * Resets Doodler vx if neither of LEFT or RIGHT is pressed
 */
function keyReleased() {
    if (
        !keyIsDown(LEFT_ARROW) &&
        !keyIsDown(RIGHT_ARROW) &&
        !keyIsDown(65) &&
        !keyIsDown(68) &&
        doodler.vx != 0
    ) {
        doodler.vx = 0;
    }
}

/**
 * Touch event mobile
 */
function touchStarted() {
    // LEFT
    if (mouseX < width / 2 && doodler.vx !== -Doodler.speed) {
        doodler.vx = -Doodler.speed;
        doodler.direction = Doodler.Direction.LEFT;
    } else if (mouseX >= width / 2 && doodler.vx !== Doodler.speed) {
        // RIGHT
        doodler.vx = Doodler.speed;
        doodler.direction = Doodler.Direction.RIGHT;
    }
}

/**
 * Touch moved event mobile
 */
function touchMoved() {
    touchStarted();
}

/**
 * Touch end event mobile
 */
function touchEnded() {
    if (doodler.vx != 0) {
        doodler.vx = 0;
    }
}

/**
 * Window resized event hook, keep 16:9
 */
function windowResized() {
    stepSize = windowHeight / config.STEPS;
    isMobile = window.matchMedia("only screen and (max-width: 768px)").matches;
    if (!isMobile) {
        resizeCanvas((windowHeight * 9) / 16, windowHeight);
    }
    cell = windowHeight / 30;

    // Set doodler props
    if (height > 0) {
        const REF_HEIGHT = 1289;
        const heightRatio = height / REF_HEIGHT;
        Doodler.jumpForce *= heightRatio;
        Doodler.superJumpForce *= heightRatio;
        config.GRAVITY *= heightRatio;
        config.MAX_FALLING_SPEED *= heightRatio;
    }
    if (width > 0) {
        const REF_WIDTH = 725;
        const widthRatio = width / REF_WIDTH;
        Doodler.speed *= widthRatio;
    }
}

// utils

/**
 * Draw background grid and copyright info
 */
function drawBackground() {
    background("#f5eee4");
    stroke(225, 125, 0);
    strokeWeight(0.8);
    // horizontal lines
    for (let i = 0; i < height; i += cell) {
        line(0, i, width, i);
    }
    // vertical lines
    for (let i = 0; i < width; i += cell) {
        line(i, 0, i, height);
    }
}

/**
 * Draw score on the top right
 */
function drawScore() {
    const fontSize = 24;
    const scoreStr = `SCORE: ${score.toLocaleString()}`;
    const strWidth = textWidth(scoreStr);
    let margin = 10;
    textSize(fontSize);
    textStyle(NORMAL);
    textAlign(LEFT);
    fill(60);
    noStroke();
    text(scoreStr, width - strWidth - margin, margin + fontSize);
    // draw copy right
    textStyle(ITALIC);
    text("Author: github.com/takosenpai2687", margin, height - margin);
    // draw FPS
    text("FPS: " + Math.floor(frameRate()) || 0, margin, height - 30);
}

/**
 * Check collision between a Doodler and a Platform
 * @param {Doodler} doodler
 * @param {Platform | any} platform
 * @returns {Boolean} isColliding
 */
function checkCollision(doodler, platform) {
    if (isOver) return false;
    return (
        doodler.x - Doodler.w / 4 < platform.x + Platform.w / 2 && // right edge
        doodler.x + Doodler.w / 4 > platform.x - Platform.w / 2 && // left edge
        doodler.y + Doodler.h / 2 > platform.y - Platform.h / 2 && // top edge
        doodler.y + Doodler.h / 2 < platform.y // bottom edge
    );
}

/**
 * Generate platforms at startup
 */
function generatePlatforms() {
    stepSize = Math.floor(height / config.STEPS);
    for (let y = height; y > 0; y -= stepSize) {
        const x = Platform.w / 2 + (width - Platform.w) * Math.random();
        let type = Platform.platformTypes.getRandomType();
        while (type === Platform.platformTypes.FRAGILE) {
            type = Platform.platformTypes.getRandomType();
        }
        const springed = Math.random() < config.SPRINGED_CHANCE;
        platforms.push(new Platform(x, y, type, springed));
    }
}

/**
 * Animation updater after death
 * Keep falling until no platforms or blackhole in sight
 */
function drawDead() {
    if (!platforms.length && !blackhole) {
        textAlign(CENTER);
        text("Game Over!", width / 2, height / 2);
    } else if (!isBlackholed) {
        // Still falling
        doodler.render();
        for (let i = platforms.length - 1; i >= 0; i--) {
            platforms[i].y -= Doodler.jumpForce;
            if (platforms[i].y < 0) {
                platforms.splice(i, 1);
            }
        }
        if (blackhole) {
            blackhole.y -= Doodler.jumpForce;
            if (blackhole.y < 0) {
                blackhole = null;
            }
        }
    } else {
        // Is absorbed by a blackhole
        doodler.render();
        Doodler.w -= 0.5;
        Doodler.h -= 0.5;
        if (Doodler.w < 0 || Doodler.h < 0) {
            platforms = [];
            blackhole = null;
        }
    }
}
