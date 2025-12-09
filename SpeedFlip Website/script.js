// Rocket League Speedflip Trainer
// Uses the browser Gamepad API and assumes default Xbox-style Rocket League bindings.

const STATE = {
  gamepadIndex: null,
  prevButtons: [],
  prevAxes: [],
  animationFrame: null,
  attempts: [], // history
  attemptCounter: 0,
  currentAttempt: null,
  bindingMode: null, // { actionKey: string }
  config: {
    deadzone: 0.3,
    dodgeDeadzone: 0.5,
  },
};

// Default mapping for an Xbox-style controller with Rocket League default bindings
const MAPPING = {
  jumpButton: null,
  boostButton: null,
  neutralAirRollButton: null,
  dirAirRollLeftButton: null,
  dirAirRollRightButton: null,
  reverseButton: null,
  throttleButton: null,
  resetShotButton: null, // user bound; used to start attempts
  leftStickXAxis: 0,
  leftStickYAxis: 1,
};

const CONSTANTS = {
  stickActiveThreshold: 0.2,
  flipCancelDownThreshold: 0.35, // stick y > this (down) counts as flip cancel
  settleMinMs: 150,
  maxHistory: 20,
  timelineMaxDurationMs: 1400,
};

function $(id) {
  return document.getElementById(id);
}

const els = {
  gamepadStatus: $("gamepad-status"),
  attemptStatus: $("attempt-status"),
  startAttemptBtn: $("start-attempt-btn"),
  // current stats
  settleTime: $("stat-settle-time"),
  settleGrade: $("stat-settle-grade"),
  boostBeforeThrottle: $("stat-boost-before-throttle"),
  jumpDelayMs: $("stat-jump-delay-ms"),
  jumpDelayGrade: $("stat-jump-delay-grade"),
  angleDeg: $("stat-angle-deg"),
  angleGrade: $("stat-angle-grade"),
  jumpGapMs: $("stat-jump-gap-ms"),
  jumpGapGrade: $("stat-jump-gap-grade"),
  cancelMs: $("stat-cancel-ms"),
  cancelGrade: $("stat-cancel-grade"),
  attemptHistory: $("attempt-history"),
  // live angle debug
  liveStickX: $("live-stick-x"),
  liveStickY: $("live-stick-y"),
  liveAngleDeg: $("live-angle-deg"),
  deadzoneSlider: $("deadzone-slider"),
  deadzoneValue: $("deadzone-value"),
  dodgeDeadzoneSlider: $("dodge-deadzone-slider"),
  dodgeDeadzoneValue: $("dodge-deadzone-value"),
  // timeline
  timelineCanvas: $("timeline-canvas"),
  // bindings
  bindingStatus: $("binding-status"),
  bindingResetLabel: $("binding-reset-label"),
  bindingJumpLabel: $("binding-jump-label"),
  bindingBoostLabel: $("binding-boost-label"),
  bindingThrottleLabel: $("binding-throttle-label"),
  bindingReverseLabel: $("binding-reverse-label"),
  bindingNeutralRollLabel: $("binding-neutral-roll-label"),
  bindingDirRollLeftLabel: $("binding-dir-roll-left-label"),
  bindingDirRollRightLabel: $("binding-dir-roll-right-label"),
};

let timelineCtx = null;

function init() {
  window.addEventListener("gamepadconnected", (e) => {
    if (STATE.gamepadIndex === null) {
      STATE.gamepadIndex = e.gamepad.index;
      STATE.prevButtons = e.gamepad.buttons.map((b) => b.pressed || b.value > 0.5);
      STATE.prevAxes = e.gamepad.axes.slice();
      updateGamepadStatus(e.gamepad, true);
      startLoop();
    }
  });

  window.addEventListener("gamepaddisconnected", (e) => {
    if (STATE.gamepadIndex === e.gamepad.index) {
      updateGamepadStatus(null, false);
      STATE.gamepadIndex = null;
      if (STATE.animationFrame != null) {
        cancelAnimationFrame(STATE.animationFrame);
        STATE.animationFrame = null;
      }
    }
  });

  els.startAttemptBtn.addEventListener("click", () => {
    startNewAttempt();
  });

  // Bindings: press-to-bind flow
  document.querySelectorAll("[data-bind-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const actionKey = btn.getAttribute("data-bind-action");
      if (!actionKey) return;
      STATE.bindingMode = { actionKey };
      els.bindingStatus.textContent =
        "Rebinding " +
        describeActionKey(actionKey) +
        ". Press the button you use for this action on your controller.";
    });
  });

  if (els.timelineCanvas && els.timelineCanvas.getContext) {
    timelineCtx = els.timelineCanvas.getContext("2d");
  }

  // Deadzone sliders (Rocket League style)
  if (els.deadzoneSlider && els.deadzoneValue) {
    els.deadzoneSlider.value = Math.round(STATE.config.deadzone * 100);
    els.deadzoneValue.textContent = STATE.config.deadzone.toFixed(2);
    els.deadzoneSlider.addEventListener("input", () => {
      STATE.config.deadzone = Number(els.deadzoneSlider.value) / 100;
      els.deadzoneValue.textContent = STATE.config.deadzone.toFixed(2);
    });
  }
  if (els.dodgeDeadzoneSlider && els.dodgeDeadzoneValue) {
    els.dodgeDeadzoneSlider.value = Math.round(STATE.config.dodgeDeadzone * 100);
    els.dodgeDeadzoneValue.textContent = STATE.config.dodgeDeadzone.toFixed(2);
    els.dodgeDeadzoneSlider.addEventListener("input", () => {
      STATE.config.dodgeDeadzone = Number(els.dodgeDeadzoneSlider.value) / 100;
      els.dodgeDeadzoneValue.textContent = STATE.config.dodgeDeadzone.toFixed(2);
    });
  }

  // Unbind all button
  const unbindAllBtn = document.getElementById("unbind-all-btn");
  if (unbindAllBtn) {
    unbindAllBtn.addEventListener("click", () => {
      MAPPING.resetShotButton = null;
      MAPPING.jumpButton = null;
      MAPPING.boostButton = null;
      MAPPING.throttleButton = null;
      MAPPING.reverseButton = null;
      MAPPING.neutralAirRollButton = null;
      MAPPING.dirAirRollLeftButton = null;
      MAPPING.dirAirRollRightButton = null;
      els.bindingStatus.textContent = "All bindings cleared.";
      STATE.bindingMode = null;
      renderBindings();
    });
  }

  // ESC while in binding mode: cancel & clear binding
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && STATE.bindingMode) {
      const { actionKey } = STATE.bindingMode;
      if (actionKey && actionKey in MAPPING) {
        MAPPING[actionKey] = null;
      }
      els.bindingStatus.textContent =
        "Binding for " + describeActionKey(actionKey) + " cleared.";
      STATE.bindingMode = null;
      renderBindings();
    }
  });

  renderBindings();

  // Try to grab an already-connected gamepad (user may have pressed a button already)
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let i = 0; i < pads.length; i++) {
    const gp = pads[i];
    if (gp) {
      STATE.gamepadIndex = gp.index;
      STATE.prevButtons = gp.buttons.map((b) => b.pressed || b.value > 0.5);
      STATE.prevAxes = gp.axes.slice();
      updateGamepadStatus(gp, true);
      startLoop();
      break;
    }
  }
}

function updateGamepadStatus(gamepad, connected) {
  if (!connected || !gamepad) {
    els.gamepadStatus.textContent = "Not connected";
    els.gamepadStatus.classList.remove("status-good");
    els.gamepadStatus.classList.add("status-bad");
    return;
  }
  els.gamepadStatus.textContent = gamepad.id || "Controller connected";
  els.gamepadStatus.classList.remove("status-bad");
  els.gamepadStatus.classList.add("status-good");
}

function startLoop() {
  if (STATE.animationFrame != null) return;

  const loop = () => {
    STATE.animationFrame = requestAnimationFrame(loop);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = STATE.gamepadIndex != null ? pads[STATE.gamepadIndex] : null;
    if (!gp) return;
    processGamepad(gp);
  };

  loop();
}

function createEmptyAttempt() {
  const now = performance.now();
  STATE.attemptCounter += 1;
  return {
    id: STATE.attemptCounter,
    startedAt: now,
    firstInputTime: null,
    settleTime: null,
    boostOnTime: null,
    throttleOnTime: null,
    boostBeforeThrottle: null,
    firstJumpTime: null,
    secondJumpTime: null,
    jumpDelayMs: null,
    jumpDelayGrade: null,
    angleDeg: null,
    angleGrade: null,
    jumpGapMs: null,
    jumpGapGrade: null,
    flipCancelTime: null,
    flipCancelMs: null,
    flipCancelGrade: null,
    lastStick: { x: 0, y: 0, active: false },
    completed: false,
    samples: [], // timeline samples
  };
}

function startNewAttempt() {
  // Optionally archive previous attempt if it had any data
  if (STATE.currentAttempt && !STATE.currentAttempt.completed) {
    finalizeAttempt(STATE.currentAttempt);
  }

  STATE.currentAttempt = createEmptyAttempt();
  els.attemptStatus.textContent = "Recording… (attempt " + STATE.currentAttempt.id + ")";
  els.attemptStatus.classList.remove("status-bad", "status-warn");
  els.attemptStatus.classList.add("status-good");

  // Reset on-screen stats
  renderCurrentAttempt();
}

function markInputSeen(type, time) {
  const att = STATE.currentAttempt;
  if (!att) return;

  if (att.firstInputTime == null) {
    att.firstInputTime = time;
    att.settleTime = time - att.startedAt;
  }

  if (type === "boost") {
    if (att.boostOnTime == null) {
      att.boostOnTime = time;
    }
  } else if (type === "throttle") {
    if (att.throttleOnTime == null) {
      att.throttleOnTime = time;
    }
    if (att.boostOnTime != null) {
      att.boostBeforeThrottle = att.boostOnTime <= att.throttleOnTime;
    } else {
      att.boostBeforeThrottle = false;
    }
  }
}

function onJumpPressed(time) {
  const att = STATE.currentAttempt;
  if (!att) return;

  markInputSeen("jump", time);

  if (att.firstJumpTime == null) {
    att.firstJumpTime = time;
    if (att.firstInputTime != null) {
      const dt = time - att.firstInputTime;
      att.jumpDelayMs = dt;
      att.jumpDelayGrade = gradeFirstInputToJump(dt);
    }
  } else if (att.secondJumpTime == null) {
    att.secondJumpTime = time;
    // Angle at second jump (Rocket League dodge angle using deadzone + dodge deadzone)
    const { x, y } = att.lastStick; // x: raw, y: up-positive
    const mag = Math.hypot(x, y);
    if (mag >= CONSTANTS.stickActiveThreshold) {
      const gameVec = toGameCoordinatesRL(x, y, STATE.config.deadzone);
      const dodgeVec = toDodgeCoordinatesRL(
        gameVec.x,
        gameVec.y,
        STATE.config.dodgeDeadzone
      );
      const rlAngle = angleDodgeRL(dodgeVec);
      if (rlAngle != null) {
        const signed = rlAngle > 180 ? rlAngle - 360 : rlAngle;
        att.angleDeg = signed;
        att.angleGrade = gradeSpeedflipAngle(signed);
      } else {
        att.angleDeg = null;
        att.angleGrade = { label: "No dodge", level: "bad" };
      }
    } else {
      att.angleDeg = null;
      att.angleGrade = { label: "No stick input", level: "bad" };
    }

    if (att.firstJumpTime != null) {
      const gap = time - att.firstJumpTime;
      att.jumpGapMs = gap;
      att.jumpGapGrade = gradeJumpGap(gap);
    }
  }
}

function onFlipCancelDetected(time) {
  const att = STATE.currentAttempt;
  if (!att || att.secondJumpTime == null || att.flipCancelTime != null) return;

  att.flipCancelTime = time;
  const dt = time - att.secondJumpTime;
  att.flipCancelMs = dt;
  att.flipCancelGrade = gradeFlipCancel(dt);
}

function processGamepad(gp) {
  const now = performance.now();

  // Process buttons for edge detection
  const newPrevButtons = [];
  for (let i = 0; i < gp.buttons.length; i++) {
    const b = gp.buttons[i];
    const pressed = b.pressed || b.value > 0.5;
    const wasPressed = STATE.prevButtons[i] || false;

    if (pressed && !wasPressed) {
      // If we're in binding mode, use the first button press for rebinding instead of gameplay
      if (STATE.bindingMode) {
        handleBindingButtonPress(i);
      } else {
        handleButtonDown(i, now);
      }
    }

    newPrevButtons[i] = pressed;
  }

  // Process axes for stick movement and flip cancel
  const x = gp.axes[MAPPING.leftStickXAxis] || 0;
  const y = gp.axes[MAPPING.leftStickYAxis] || 0;

  const prevX = STATE.prevAxes[MAPPING.leftStickXAxis] ?? 0;
  const prevY = STATE.prevAxes[MAPPING.leftStickYAxis] ?? 0;

  const mag = Math.hypot(x, y);
  const prevMag = Math.hypot(prevX, prevY);
  const stickActive = mag >= CONSTANTS.stickActiveThreshold;
  const prevStickActive = prevMag >= CONSTANTS.stickActiveThreshold;

  // Live angle debug (Rocket League-style deadzone + dodge deadzone)
  const rawX = x;
  const rawYUp = -y; // invert: RL math expects +Y up
  const gameVec = toGameCoordinatesRL(rawX, rawYUp, STATE.config.deadzone);
  const dodgeVec = toDodgeCoordinatesRL(
    gameVec.x,
    gameVec.y,
    STATE.config.dodgeDeadzone
  );
  const rlDodgeAngle = angleDodgeRL(dodgeVec);
  const signedAngle =
    rlDodgeAngle != null
      ? (rlDodgeAngle > 180 ? rlDodgeAngle - 360 : rlDodgeAngle)
      : null;

  els.liveStickX.textContent = "Raw X: " + rawX.toFixed(2);
  els.liveStickY.textContent = "Raw Y: " + rawYUp.toFixed(2);
  els.liveAngleDeg.textContent =
    signedAngle != null ? "Dodge angle: " + signedAngle.toFixed(1) + "°" : "Dodge angle: –";

  if (STATE.currentAttempt) {
    const att = STATE.currentAttempt;
    att.lastStick = { x: rawX, y: rawYUp, active: stickActive };

    // First stick input counts toward "car settled"
    if (stickActive && !prevStickActive) {
      markInputSeen("stick", now);
    }

    // Flip cancel: after second jump, look for stick pushed downward
    if (att.secondJumpTime != null && att.flipCancelTime == null) {
      if (y > CONSTANTS.flipCancelDownThreshold) {
        onFlipCancelDetected(now);
      }
    }

    // Record sample for timeline
    const t = now - att.startedAt;
    const boostPressed =
      gp.buttons[MAPPING.boostButton] &&
      (gp.buttons[MAPPING.boostButton].pressed ||
        gp.buttons[MAPPING.boostButton].value > 0.5);
    const throttlePressed =
      gp.buttons[MAPPING.throttleButton] &&
      (gp.buttons[MAPPING.throttleButton].pressed ||
        gp.buttons[MAPPING.throttleButton].value > 0.5);
    const jumpPressed =
      gp.buttons[MAPPING.jumpButton] &&
      (gp.buttons[MAPPING.jumpButton].pressed ||
        gp.buttons[MAPPING.jumpButton].value > 0.5);

    const angleSample =
      mag >= CONSTANTS.stickActiveThreshold ? signedAngle : null;

    // Only record samples for the timeline while Boost is being held
    if (boostPressed) {
      att.samples.push({
        t,
        angleDeg: angleSample,
        boost: Boolean(boostPressed),
        throttle: Boolean(throttlePressed),
        jump: Boolean(jumpPressed),
      });

      // Keep samples within a window so canvas doesn't get overloaded
      const cutoff =
        (att.firstInputTime || att.startedAt) +
        CONSTANTS.timelineMaxDurationMs -
        att.startedAt;
      while (att.samples.length && att.samples[0].t < cutoff - CONSTANTS.timelineMaxDurationMs) {
        att.samples.shift();
      }
    }
  }

  STATE.prevButtons = newPrevButtons;
  STATE.prevAxes = gp.axes.slice();

  renderCurrentAttempt();
  renderTimeline();
}

function handleButtonDown(buttonIndex, time) {
  const mapping = MAPPING;

  if (mapping.resetShotButton != null && buttonIndex === mapping.resetShotButton) {
    startNewAttempt();
  } else if (buttonIndex === mapping.jumpButton) {
    onJumpPressed(time);
  } else if (buttonIndex === mapping.boostButton) {
    markInputSeen("boost", time);
  } else if (buttonIndex === mapping.throttleButton) {
    markInputSeen("throttle", time);
  } else if (buttonIndex === mapping.reverseButton) {
    markInputSeen("reverse", time);
  }
}

function handleBindingButtonPress(buttonIndex) {
  const mode = STATE.bindingMode;
  if (!mode) return;

  MAPPING[mode.actionKey] = buttonIndex;
  els.bindingStatus.textContent =
    "Bound " + describeActionKey(mode.actionKey) + " to button " + buttonIndex + ".";
  STATE.bindingMode = null;
  renderBindings();
}

// Rocket League-style deadzone & dodge math (adapted from HalfwayDead's visualizer)

function toGameCoordinatesRL(rawX, rawYUp, deadzone) {
  let gameX;
  let gameY;

  if (rawX > 0) {
    if (rawX > deadzone) {
      gameX = (rawX - deadzone) / (1 - deadzone);
    } else {
      gameX = 0;
    }
  } else {
    if (Math.abs(rawX) > deadzone) {
      gameX = (rawX + deadzone) / (1 - deadzone);
    } else {
      gameX = 0;
    }
  }

  if (rawYUp > 0) {
    if (rawYUp > deadzone) {
      gameY = (rawYUp - deadzone) / (1 - deadzone);
    } else {
      gameY = 0;
    }
  } else {
    if (Math.abs(rawYUp) > deadzone) {
      gameY = (rawYUp + deadzone) / (1 - deadzone);
    } else {
      gameY = 0;
    }
  }

  return { x: gameX, y: gameY };
}

function toDodgeCoordinatesRL(gameX, gameY, dodgeThreshold) {
  let dodgeX = 0;
  let dodgeY = 0;
  if (Math.abs(gameX) + Math.abs(gameY) >= dodgeThreshold) {
    dodgeX = gameX;
    dodgeY = gameY;
  }
  return { x: dodgeX, y: dodgeY };
}

function angleVectorRL(vec) {
  const { x, y } = vec;
  if (x === 0 && y === 0) return null;

  const deg = (r) => (r * 180) / Math.PI;
  let out = 0;

  if (x >= 0 && y <= 0) {
    // quadrant: up-right
    out = 90 + deg(Math.atan(-y / x));
  } else if (x < 0 && y < 0) {
    // quadrant: up-left
    out = 180 + deg(Math.atan(-x / -y));
  } else if (x < 0) {
    // left-down
    out = 270 + deg(Math.atan(y / -x));
  } else {
    // right-down
    out = deg(Math.atan(x / y));
  }

  return out;
}

function angleDodgeRL(vec) {
  const { x, y } = vec;
  if (x === 0 && y === 0) return null;

  const deg = (r) => (r * 180) / Math.PI;
  let out = 0;

  if (x >= 0 && y <= 0) {
    if (Math.abs(y / x) <= 0.1) {
      out = 90;
    } else if (Math.abs(x / y) <= 0.1) {
      out = 180;
    } else {
      out = 90 + deg(Math.atan(-y / x));
    }
  } else if (x < 0 && y < 0) {
    if (Math.abs(-x / y) <= 0.1) {
      out = 180;
    } else if (Math.abs(y / x) <= 0.1) {
      out = 270;
    } else {
      out = 180 + deg(Math.atan(-x / -y));
    }
  } else if (x < 0) {
    if (Math.abs(y / -x) <= 0.1) {
      out = 270;
    } else if (Math.abs(x / y) <= 0.1) {
      out = 0;
    } else {
      out = 270 + deg(Math.atan(y / -x));
    }
  } else {
    if (Math.abs(x / y) <= 0.1) {
      out = 0;
    } else if (Math.abs(y / x) <= 0.1) {
      out = 90;
    } else {
      out = deg(Math.atan(x / y));
    }
  }

  return out;
}

function gradeFirstInputToJump(ms) {
  if (ms < 414) {
    return { label: "Fast", level: "bad", color: "red" };
  }
  if (ms <= 460) {
    return { label: "Bit Fast", level: "warn", color: "yellow" };
  }
  if (ms <= 630) {
    return { label: "Perfect", level: "good", color: "green" };
  }
  if (ms <= 674) {
    return { label: "Bit Slow", level: "warn", color: "yellow" };
  }
  return { label: "Slow", level: "bad", color: "red" };
}

function gradeSpeedflipAngle(angleDeg) {
  // angleDeg is signed (-180..180) after RL deadzone + dodge deadzone
  if (angleDeg <= -37 && angleDeg >= -23) {
    return { label: "Perfect", level: "good", color: "green" };
  }
  if (
    (angleDeg <= -38 && angleDeg >= -45) ||
    (angleDeg <= -15 && angleDeg >= -22)
  ) {
    return { label: "OK", level: "warn", color: "yellow" };
  }
  return { label: "Bad", level: "bad", color: "red" };
}

function gradeJumpGap(ms) {
  if (ms <= 115) {
    return { label: "Good", level: "good", color: "green" };
  }
  return { label: "Slow", level: "bad", color: "red" };
}

function gradeFlipCancel(ms) {
  if (ms < 50) {
    return { label: "Good", level: "good", color: "green" };
  }
  if (ms < 75) {
    return { label: "OK", level: "warn", color: "yellow" };
  }
  return { label: "Slow", level: "bad", color: "red" };
}

function applyGradePill(el, grade) {
  el.classList.remove("grade-good", "grade-warn", "grade-bad");
  if (!grade || !grade.label) {
    el.textContent = "–";
    return;
  }
  el.textContent = grade.label;
  if (grade.level === "good") el.classList.add("grade-good");
  else if (grade.level === "warn") el.classList.add("grade-warn");
  else if (grade.level === "bad") el.classList.add("grade-bad");
}

function renderCurrentAttempt() {
  const att = STATE.currentAttempt;
  if (!att) {
    els.settleTime.textContent = "–";
    els.settleGrade.textContent = "–";
    els.boostBeforeThrottle.textContent = "–";
    els.jumpDelayMs.textContent = "–";
    els.angleDeg.textContent = "–";
    els.jumpGapMs.textContent = "–";
    els.cancelMs.textContent = "–";
    return;
  }

  // Car settled
  if (att.settleTime != null) {
    const ms = Math.round(att.settleTime);
    els.settleTime.textContent = ms + " ms";
    const ok = ms >= CONSTANTS.settleMinMs;
    const grade = ok
      ? { label: "OK", level: "good" }
      : { label: "Too Early", level: "bad" };
    applyGradePill(els.settleGrade, grade);
  } else {
    els.settleTime.textContent = "–";
    els.settleGrade.textContent = "–";
  }

  // Boost before throttle
  if (att.boostBeforeThrottle == null) {
    els.boostBeforeThrottle.textContent =
      att.throttleOnTime || att.boostOnTime ? "Pending…" : "No throttle yet";
  } else {
    els.boostBeforeThrottle.textContent = att.boostBeforeThrottle ? "Yes" : "No";
    els.boostBeforeThrottle.classList.toggle("grade-bad", !att.boostBeforeThrottle);
    els.boostBeforeThrottle.classList.toggle(
      "grade-good",
      Boolean(att.boostBeforeThrottle)
    );
  }

  // First input -> first jump
  if (att.jumpDelayMs != null) {
    const ms = Math.round(att.jumpDelayMs);
    els.jumpDelayMs.textContent = ms + " ms";
    applyGradePill(els.jumpDelayGrade, att.jumpDelayGrade);
  } else {
    els.jumpDelayMs.textContent = "–";
    els.jumpDelayGrade.textContent = "–";
  }

  // Angle at second jump
  if (att.angleDeg != null) {
    els.angleDeg.textContent = att.angleDeg.toFixed(1) + "°";
    applyGradePill(els.angleGrade, att.angleGrade);
  } else if (att.secondJumpTime != null) {
    els.angleDeg.textContent = "–";
    applyGradePill(els.angleGrade, att.angleGrade);
  } else {
    els.angleDeg.textContent = "–";
    els.angleGrade.textContent = "–";
  }

  // Time between jumps
  if (att.jumpGapMs != null) {
    const ms = Math.round(att.jumpGapMs);
    els.jumpGapMs.textContent = ms + " ms";
    applyGradePill(els.jumpGapGrade, att.jumpGapGrade);
  } else {
    els.jumpGapMs.textContent = "–";
    els.jumpGapGrade.textContent = "–";
  }

  // Flip cancel timing
  if (att.flipCancelMs != null) {
    const ms = Math.round(att.flipCancelMs);
    els.cancelMs.textContent = ms + " ms";
    applyGradePill(els.cancelGrade, att.flipCancelGrade);
  } else if (att.secondJumpTime != null) {
    els.cancelMs.textContent = "Waiting…";
    els.cancelGrade.textContent = "–";
  } else {
    els.cancelMs.textContent = "–";
    els.cancelGrade.textContent = "–";
  }
}

function describeActionKey(key) {
  switch (key) {
    case "jumpButton":
      return "Jump";
    case "boostButton":
      return "Boost";
    case "throttleButton":
      return "Throttle";
    case "reverseButton":
      return "Reverse";
    case "neutralAirRollButton":
      return "Neutral Air Roll";
    case "dirAirRollLeftButton":
      return "Directional Air Roll Left";
    case "dirAirRollRightButton":
      return "Directional Air Roll Right";
    default:
      return key;
  }
}

function renderBindings() {
  const labels = [
    ["resetShotButton", els.bindingResetLabel],
    ["jumpButton", els.bindingJumpLabel],
    ["boostButton", els.bindingBoostLabel],
    ["throttleButton", els.bindingThrottleLabel],
    ["reverseButton", els.bindingReverseLabel],
    ["neutralAirRollButton", els.bindingNeutralRollLabel],
    ["dirAirRollLeftButton", els.bindingDirRollLeftLabel],
    ["dirAirRollRightButton", els.bindingDirRollRightLabel],
  ];

  labels.forEach(([key, el]) => {
    if (!el) return;
    const index = MAPPING[key];
    if (index == null || typeof index === "undefined") {
      el.textContent = "Not bound";
    } else {
      el.textContent = "Button " + index;
    }
  });
}

function renderTimeline() {
  if (!timelineCtx || !els.timelineCanvas) return;

  const ctx = timelineCtx;
  const canvas = els.timelineCanvas;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const att = STATE.currentAttempt;
  if (!att || !att.samples || att.samples.length === 0) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("Start an attempt to see the timeline.", 12, h / 2);
    return;
  }

  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 18;
  const paddingBottom = 38;

  const usableWidth = w - paddingLeft - paddingRight;
  const usableHeight = h - paddingTop - paddingBottom;

  const lastT = att.samples[att.samples.length - 1].t;
  const maxT = Math.max(lastT, 400); // min range

  // Axes
  ctx.strokeStyle = "rgba(55,65,81,0.9)";
  ctx.lineWidth = 1;

  // Time axis (bottom)
  const xAxisY = h - paddingBottom + 10;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, xAxisY);
  ctx.lineTo(w - paddingRight, xAxisY);
  ctx.stroke();

  // Zero angle line (center)
  const midY = paddingTop + usableHeight / 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(75,85,99,0.9)";
  ctx.beginPath();
  ctx.moveTo(paddingLeft, midY);
  ctx.lineTo(w - paddingRight, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels
  ctx.fillStyle = "#9ca3af";
  ctx.font = "10px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("Angle (°)", 6, paddingTop + 8);

  // Draw angle line
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#60a5fa";
  ctx.beginPath();
  let started = false;
  att.samples.forEach((s) => {
    const x = paddingLeft + (s.t / maxT) * usableWidth;
    if (s.angleDeg == null) return;
    const y = midY - (s.angleDeg / 90) * (usableHeight / 2);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  if (started) ctx.stroke();

  // Boost / Throttle bars (bottom zone)
  const barHeight = 6;
  const boostY = h - paddingBottom + 18;
  const throttleY = boostY + barHeight + 3;

  att.samples.forEach((s) => {
    const x = paddingLeft + (s.t / maxT) * usableWidth;
    const wBar = 2;
    if (s.boost) {
      ctx.fillStyle = "#f97316"; // orange
      ctx.fillRect(x, boostY, wBar, barHeight);
    }
    if (s.throttle) {
      ctx.fillStyle = "#22c55e"; // green
      ctx.fillRect(x, throttleY, wBar, barHeight);
    }
  });

  // Event markers
  function drawMarker(time, color, label) {
    if (time == null) return;
    const t = time - att.startedAt;
    const x = paddingLeft + (t / maxT) * usableWidth;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, paddingTop);
    ctx.lineTo(x, h - paddingBottom);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "9px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(label, x + 2, paddingTop + 10);
  }

  drawMarker(att.firstInputTime, "#e5e7eb", "First Input");
  drawMarker(att.firstJumpTime, "#22c55e", "Jump 1");
  drawMarker(att.secondJumpTime, "#a855f7", "Jump 2");
  drawMarker(att.flipCancelTime, "#f97316", "Cancel");

  // Time ticks
  const stepMs = 100;
  for (let t = 0; t <= maxT; t += stepMs) {
    const x = paddingLeft + (t / maxT) * usableWidth;
    ctx.strokeStyle = "rgba(55,65,81,0.7)";
    ctx.beginPath();
    ctx.moveTo(x, xAxisY);
    ctx.lineTo(x, xAxisY + 4);
    ctx.stroke();
    ctx.fillStyle = "#6b7280";
    ctx.fillText(String(t), x - 6, xAxisY + 14);
  }
}

function finalizeAttempt(att) {
  att.completed = true;
  STATE.attempts.unshift(att);
  if (STATE.attempts.length > CONSTANTS.maxHistory) {
    STATE.attempts.length = CONSTANTS.maxHistory;
  }
  renderHistory();
}

function renderHistory() {
  const tbody = els.attemptHistory;
  tbody.innerHTML = "";

  for (const att of STATE.attempts) {
    const tr = document.createElement("tr");

    const settleGrade = att.settleTime != null && att.settleTime >= CONSTANTS.settleMinMs;

    const jumpDelayText =
      att.jumpDelayMs != null && att.jumpDelayGrade
        ? `${Math.round(att.jumpDelayMs)} ms (${att.jumpDelayGrade.label})`
        : "–";

    const angleText =
      att.angleDeg != null && att.angleGrade
        ? `${att.angleDeg.toFixed(1)}° (${att.angleGrade.label})`
        : "–";

    const jumpGapText =
      att.jumpGapMs != null && att.jumpGapGrade
        ? `${Math.round(att.jumpGapMs)} ms (${att.jumpGapGrade.label})`
        : "–";

    const cancelText =
      att.flipCancelMs != null && att.flipCancelGrade
        ? `${Math.round(att.flipCancelMs)} ms (${att.flipCancelGrade.label})`
        : att.secondJumpTime != null
        ? "No cancel"
        : "–";

    tr.innerHTML = `
      <td>${att.id}</td>
      <td class="grade-cell" style="color:${settleGrade ? '#6ee7b7' : '#fecaca'}">
        ${att.settleTime != null ? Math.round(att.settleTime) : "–"}
      </td>
      <td>${att.boostBeforeThrottle == null ? "–" : att.boostBeforeThrottle ? "Yes" : "No"}</td>
      <td>${jumpDelayText}</td>
      <td>${angleText}</td>
      <td>${jumpGapText}</td>
      <td>${cancelText}</td>
    `;

    tbody.appendChild(tr);
  }
}

document.addEventListener("DOMContentLoaded", init);


