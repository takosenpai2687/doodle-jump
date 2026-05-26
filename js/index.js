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
// Replay button
var replayButton = {
    x: 0,
    y: 0,
    w: 160,
    h: 50,
    visible: false
};

const sound = {
    blackhole: null,
    jump: null,
    spring: null,
    fragile: null,
    falling: null,
};

// Safely play a sound — iOS may fail to load audio, guard against null/errors
function playSound(s) {
    try { if (s && s.isLoaded()) s.play(); } catch (e) {}
}

/**
 * Preload event hook
 * For loading static resources before setup
 */
function preload() {
    Doodler.leftImage = loadImage("./assets/img/doodler_left.png");
    Doodler.rightImage = loadImage("./assets/img/doodler_right.png");
    Platform.springImage = loadImage("./assets/img/spring.png");
    Blackhole.blackholeImg = loadImage("./assets/img/hole.png");
    // On iOS (WebKit), Web Audio is restricted and loadSound() may never
    // fire a completion callback, causing preload() to hang forever.
    // Providing a no-op error callback lets p5.js mark each sound as done
    // even when the browser blocks or fails to load audio.
    var noop = function() {};
    soundFormats("mp3", "wav");
    sound.blackhole = loadSound("./assets/sound/blackhole.mp3", noop, noop);
    sound.jump = loadSound("./assets/sound/jump.wav", noop, noop);
    sound.spring = loadSound("./assets/sound/spring.mp3", noop, noop);
    sound.fragile = loadSound("./assets/sound/fragile.mp3", noop, noop);
    sound.falling = loadSound("./assets/sound/falling.mp3", noop, noop);
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
    // Enable audio for iOS devices
    userStartAudio();
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
            playSound(sound.spring);
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
                playSound(sound.fragile);
            } else {
                playSound(sound.jump);
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
        if (doodler) {
            doodler.render();
            doodler.update();
        }
        // check death from falling
        if (doodler && doodler.y >= height) {
            isOver = true;
            doodler.vx = 0;
            doodler.vy = 0;
            playSound(sound.falling);
        } else if (
            // check death from blackhole
            doodler &&
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
            playSound(sound.blackhole);
        }
        // check blackhole out of bounds
        if (blackhole && blackhole.y > height) {
            blackhole = null;
        }
        // Restrain doodler from going up above the THRESHOLD=100
        if (doodler && doodler.y <= config.THRESHOLD && doodler.vy < 0) {
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
    // Prevent default iOS behaviors like scrolling, zooming, etc.
    if (event) {
        event.preventDefault();
    }
    // LEFT
    if (mouseX < width / 2 && doodler.vx !== -Doodler.speed) {
        doodler.vx = -Doodler.speed;
        doodler.direction = Doodler.Direction.LEFT;
    } else if (mouseX >= width / 2 && doodler.vx !== Doodler.speed) {
        // RIGHT
        doodler.vx = Doodler.speed;
        doodler.direction = Doodler.Direction.RIGHT;
    }
    // Return false to prevent default behavior
    return false;
}

/**
 * Touch moved event mobile
 */
function touchMoved() {
    // Prevent default iOS behaviors like scrolling
    if (event) {
        event.preventDefault();
    }
    touchStarted();
    // Return false to prevent default behavior
    return false;
}

/**
 * Touch end event mobile
 */
function touchEnded() {
    // Prevent default iOS behaviors
    if (event) {
        event.preventDefault();
    }
    
    // Check if replay button was clicked
    if (replayButton.visible && isOver) {
        if (dist(mouseX, mouseY, replayButton.x, replayButton.y) <= replayButton.w / 2 + replayButton.h) {
            resetGame();
            return false;
        }
    }
    
    if (doodler.vx != 0) {
        doodler.vx = 0;
    }
    // Return false to prevent default behavior
    return false;
}

/**
 * Mouse pressed event for replay button
 */
function mousePressed() {
    // Check if replay button was clicked
    if (replayButton.visible && isOver) {
        if (dist(mouseX, mouseY, replayButton.x, replayButton.y) <= replayButton.w / 2 + replayButton.h) {
            resetGame();
        }
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
        // Scale movement heights
        Doodler.jumpForce *= heightRatio;
        Doodler.superJumpForce *= heightRatio;
        config.GRAVITY *= heightRatio;
        config.MAX_FALLING_SPEED *= heightRatio;
        // Scale render heights
        Doodler.h *= heightRatio;
        Platform.h *= heightRatio;
        Platform.springH *= heightRatio;
    }
    if (width > 0) {
        const REF_WIDTH = 725;
        const widthRatio = width / REF_WIDTH;
        // Scale movement widths
        Doodler.speed *= widthRatio;
        // Scale render widths
        Doodler.w *= widthRatio;
        Platform.w *= widthRatio;
        Platform.springW *= widthRatio;
    }
}

/**
 * Reset game to initial state
 */
function resetGame() {
    // CRITICAL: Stop death animation immediately by clearing death states first
    isOver = false;
    isBlackholed = false;
    paused = false;
    
    // Hide replay button immediately
    replayButton.visible = false;
    
    // Clear arrays and objects BEFORE resetting dimensions
    platforms = [];
    blackhole = null;
    doodler = null;  // Clear doodler to prevent any lingering references
    
    // Reset score
    score = 0;
    
    // Reset static class properties to base values
    // These need to be reset because windowResized modifies them
    Doodler.w = 80;
    Doodler.h = 80;
    Doodler.jumpForce = 8.15;
    Doodler.superJumpForce = 14;
    Doodler.speed = 7.2;
    
    Platform.w = 110;
    Platform.h = 28;
    Platform.speed = 2;
    Platform.springW = 14;
    Platform.springH = 14;
    
    // Reset config values
    config.GRAVITY = 0.16;
    config.MAX_FALLING_SPEED = 10;
    
    // Recalculate dimensions based on current screen size
    windowResized();
    
    // Regenerate platforms
    generatePlatforms();
    
    // Recreate doodler at starting position
    doodler = new Doodler(
        platforms[platforms.length - 2].x,
        platforms[platforms.length - 2].y - Doodler.h / 2 - Platform.h / 2
    );
    
    // Re-enable audio context for iOS (in case it was suspended)
    userStartAudio();
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
    const fontSize = 28;
    const scoreStr = `SCORE: ${score.toLocaleString()}`;
    textSize(fontSize);
    textStyle(BOLD);
    const strWidth = textWidth(scoreStr);
    let margin = 10;
    
    // Ensure score doesn't overflow - adjust positioning if needed
    let scoreX = width - strWidth - margin;
    if (scoreX < margin) {
        // If score would overflow, position it with minimum margin
        scoreX = margin;
    }
    
    textAlign(LEFT);
    fill(60);
    noStroke();
    text(scoreStr, scoreX, margin + fontSize);
    // draw copy right
    textStyle(NORMAL);
    textSize(14);
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
    // Safety check - if game was restarted, don't run death animation
    if (!isOver) {
        return;
    }
    
    if (!platforms.length && !blackhole) {
        // Show Game Over text with bold font
        textAlign(CENTER);
        textStyle(BOLD);
        textSize(48);
        fill(60);
        noStroke();
        text("GAME OVER!", width / 2, height / 2 - 60);
        
        // Show final score
        textSize(32);
        text(`Final Score: ${score.toLocaleString()}`, width / 2, height / 2);
        
        // Draw restart button (platform-style)
        replayButton.x = width / 2;
        replayButton.y = height / 2 + 70;
        replayButton.visible = true;
        
        // Draw filled platform shape
        noStroke();
        rectMode(RADIUS);
        fill(Platform.platformTypes.getColor(Platform.platformTypes.STABLE));
        
        // Middle rectangle
        rect(replayButton.x, replayButton.y, replayButton.w / 2, replayButton.h / 2);
        
        // Left semicircle (filled)
        ellipse(replayButton.x - replayButton.w / 2, replayButton.y, replayButton.h, replayButton.h);
        
        // Right semicircle (filled)
        ellipse(replayButton.x + replayButton.w / 2, replayButton.y, replayButton.h, replayButton.h);
        
        // Draw border arcs with thick stroke
        stroke(0);
        strokeWeight(4);
        
        // Left arc border
        arc(
            replayButton.x - replayButton.w / 2,
            replayButton.y,
            replayButton.h,
            replayButton.h,
            HALF_PI,
            HALF_PI + PI,
            OPEN
        );
        
        // Right arc border
        arc(
            replayButton.x + replayButton.w / 2,
            replayButton.y,
            replayButton.h,
            replayButton.h,
            HALF_PI + PI,
            HALF_PI,
            OPEN
        );
        
        // Top line border
        line(
            replayButton.x - replayButton.w / 2,
            replayButton.y - replayButton.h / 2,
            replayButton.x + replayButton.w / 2,
            replayButton.y - replayButton.h / 2
        );
        
        // Bottom line border
        line(
            replayButton.x - replayButton.w / 2,
            replayButton.y + replayButton.h / 2,
            replayButton.x + replayButton.w / 2,
            replayButton.y + replayButton.h / 2
        );
        
        // Draw button text
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        textSize(24);
        fill(255);
        noStroke();
        text("RESTART", replayButton.x, replayButton.y);
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
