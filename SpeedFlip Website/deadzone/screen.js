// default values
var deadzone = 0.3;
var ss_factor = 1;
var dodge_threshold = 0.5;
var dodge_angle_snap = 0.1;
var angle = "No direction.";
var max_diag = 0.77;
var overlay_on = true;
var analog_stick = 0;
var previousPoll = 0;
var realPolls = 0;
var prev_x = 0;
var prev_y = 0;
var highest_amplitude = [0];
// dz = deadzone
var dz_canvas;
var dz_container;
var dz_arrow_canvas;
var dz_arrow_container;
// round overlay
var dz_overlay_canvas;
var dz_overlay_container;

// do = dodge
var do_canvas;
var do_container;
var do_arrow_canvas;
var do_arrow_container;
// round overlay
var do_overlay_canvas;
var do_overlay_container;
// mouse over status
var mouse_over_dz_canvas = false;
var mouse_over_do_canvas = false;
var alt_arrow = false;
var dodge_stats = false;
var controller_set_position = 0; // controller gives position for this event
var controller_x = 0;
var controller_y = 0;
var mousePos;
var game_coords;
var dodge_coords;

var gamepads;
var selected_gamepad = 0;
var gamepad;

// The function gets called when the window is fully loaded
window.onload = function() {

    dz_canvas = document.getElementById('deadzone');
    dz_container = new CanvasLayers.Container(dz_canvas, false);

    dz_container.onRender = function(layer, rect, context) {
        createDZBackground(context, layer.getWidth(), layer.getHeight());
    }

    dz_arrow_canvas = document.getElementById('deadzone_arrow');
    dz_arrow_container = new CanvasLayers.Container(dz_arrow_canvas, false);

    dz_arrow_container.onRender = function(layer, rect, context){
        if (mouse_over_dz_canvas) {
            context.clearRect(0,0,layer.getWidth(), layer.getHeight());
            drawCircleMouse(layer.getWidth(), context);
            drawDeadzoneArrow(layer.getWidth(), context);
            // createCircleOverlay(context, layer.getWidth(), layer.getHeight());
        } else {
            context.clearRect(0,0,layer.getWidth(), layer.getHeight());
        }
    }

    dz_overlay_canvas = document.getElementById('deadzone_circle_overlay');
    dz_overlay_container = new CanvasLayers.Container(dz_overlay_canvas, true);

    dz_overlay_container.onRender = function(layer, rect, context) {
        if (overlay_on) {
            createCircleOverlay(context, layer.getWidth(), layer.getHeight());
        } else {
            context.clearRect(0,0,layer.getWidth(), layer.getHeight());
        }
    }   

    dz_overlay_canvas.addEventListener('mousemove', function(evt) {
        mouse_over_dz_canvas = true;
        mousePos = getMousePos(dz_overlay_canvas, evt);
        deadzone = document.getElementById("deadzone_slider").value/100;
        var raw_x = mousePos.x / ((dz_overlay_canvas.width-1) / 2) -1;
        var raw_y = 1 - mousePos.y / ((dz_overlay_canvas.height-1) / 2);
        if (controller_set_position)
        {
            raw_x = controller_x;
            raw_y = controller_y;
            controller_set_position--;
        }
        game_coords = toGameCoordinates(raw_x, raw_y);
        
        // var amplitude = Math.sqrt(raw_y * raw_y + raw_x * raw_x);
        // highest_amplitude.sort();
        // if (amplitude > highest_amplitude[0])
        // {
        //     if (highest_amplitude.length >= 10) highest_amplitude.splice(0,1);
        //     highest_amplitude.push(amplitude);
        // }
        // var amp_avg = 0;
        // for (let theval of highest_amplitude)
        // {
        //     amp_avg += theval;
        // }
        // amp_avg /= highest_amplitude.length;
        var message = '' + raw_x.toFixed(2) + ', ' + raw_y.toFixed(2); // + ', ' + amp_avg.toFixed(3)
        document.getElementById("coordinates").innerHTML =  message;
        message = '' + game_coords.x.toFixed(2) + ', ' + game_coords.y.toFixed(2);
        document.getElementById("coordinates_game").innerHTML =  message;

        angle = angleVector(game_coords);
        if (angle == "No direction."){
            message = '' + angle;
        } else {
            message = '' + Math.round(angle) + "°";
        }
        document.getElementById("direction").innerHTML =  message;

        dz_arrow_container.markRectsDamaged();
        dz_arrow_container.redraw();

    }, false);

    dz_overlay_canvas.addEventListener("mouseenter", function(evt) {
        mouse_over_dz_canvas = true;
    });

    dz_overlay_canvas.addEventListener("mouseleave", function(evt) {
        mouse_over_dz_canvas = false;
        dz_arrow_container.markRectsDamaged();
        dz_arrow_container.redraw();
    });


    // Set up touch events for mobile, etc
    dz_overlay_canvas.addEventListener("touchstart", function (e) {
        mousePos = getTouchPos(dz_overlay_canvas, e);
        var touch = e.touches[0];
        var mouseEvent = new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        dz_overlay_canvas.dispatchEvent(mouseEvent);
    }, false);

    dz_overlay_canvas.addEventListener("touchend", function (e) {
      var mouseEvent = new MouseEvent("mouseleave", {});
      dz_overlay_canvas.dispatchEvent(mouseEvent);
    }, false);

    dz_overlay_canvas.addEventListener("touchmove", function (e) {
        var touch = e.touches[0];
        var mouseEvent = new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        dz_overlay_canvas.dispatchEvent(mouseEvent);
    }, false);



    do_canvas = document.getElementById('dodge');
    do_container = new CanvasLayers.Container(do_canvas, false);

    do_container.onRender = function(layer, rect, context) {
        createDoBackground(context, layer.getWidth(), layer.getHeight());
    }

    do_arrow_canvas = document.getElementById('dodge_arrow');
    do_arrow_container = new CanvasLayers.Container(do_arrow_canvas, false);

    do_arrow_container.onRender = function(layer, rect, context){
        if (mouse_over_do_canvas) {
            context.clearRect(0,0,layer.getWidth(), layer.getHeight());
            drawCircleMouse(layer.getWidth(), context);
            drawDodgeArrow(layer.getWidth(), context);
        } else {
            context.clearRect(0,0,layer.getWidth(), layer.getHeight());
        }
    }

    do_overlay_canvas = document.getElementById('dodge_circle_overlay');
    do_overlay_container = new CanvasLayers.Container(do_overlay_canvas, true);

    do_overlay_container.onRender = function(layer, rect, context) {
        if (overlay_on) {
            createCircleOverlay(context, layer.getWidth(), layer.getHeight());
        } else {
            context.clearRect(0,0,layer.getWidth(), layer.getHeight());
        }
    }

    ss_factor = document.getElementById("AA").value;
    slider_update();
    overlay_update();

    do_overlay_canvas.addEventListener('mousemove', function(evt) {
        mouse_over_do_canvas = true;
        mousePos = getMousePos(do_overlay_canvas, evt);
        var deadzone = document.getElementById("deadzone_slider").value/100;
        var raw_x = mousePos.x / ((do_overlay_canvas.width-1) / 2) -1;
        var raw_y = 1 - mousePos.y / ((do_overlay_canvas.height-1) / 2);
        if (controller_set_position)
        {
            raw_x = controller_x;
            raw_y = controller_y;
            controller_set_position--;
        }
        game_coords = toGameCoordinates(raw_x, raw_y);
        dodge_coords = toDodgeCoordinates(game_coords.x, game_coords.y);

        var message = '' + raw_x.toFixed(2) + ', ' + raw_y.toFixed(2);
        document.getElementById("coordinates").innerHTML =  message;
        message = '' + game_coords.x.toFixed(2) + ', ' + game_coords.y.toFixed(2);
        document.getElementById("coordinates_game").innerHTML =  message;
        angle = angleDodge(dodge_coords);
        if (angle == "No dodge."){
            message = '' + angle;
        } else {
            message = '' + Math.round(angle) + "°";
        }
        
        document.getElementById("direction").innerHTML =  message;

        do_arrow_container.markRectsDamaged();
        do_arrow_container.redraw();
    }, false);

    do_overlay_canvas.addEventListener("mouseenter", function(evt) {
        mouse_over_do_canvas = true;
    });

    do_overlay_canvas.addEventListener("mouseleave", function(evt) {
        mouse_over_do_canvas = false;
        do_arrow_container.markRectsDamaged();
        do_arrow_container.redraw();
    });

    // Set up touch events for mobile, etc
    do_overlay_canvas.addEventListener("touchstart", function (e) {
        mousePos = getTouchPos(do_overlay_canvas, e);
        var touch = e.touches[0];
        var mouseEvent = new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        do_overlay_canvas.dispatchEvent(mouseEvent);
    }, false);

    do_overlay_canvas.addEventListener("touchend", function (e) {
      var mouseEvent = new MouseEvent("mouseleave", {});
      do_overlay_canvas.dispatchEvent(mouseEvent);
    }, false);

    do_overlay_canvas.addEventListener("touchmove", function (e) {
        var touch = e.touches[0];
        var mouseEvent = new MouseEvent("mousemove", {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        do_overlay_canvas.dispatchEvent(mouseEvent);
    }, false);

    // Prevent scrolling when touching the canvas
    document.body.addEventListener("touchstart", function (e) {
        if (e.target == dz_overlay_canvas || e.target == do_overlay_canvas) {
            e.preventDefault();
        }
    }, false);

    document.body.addEventListener("touchend", function (e) {
        if (e.target == dz_overlay_canvas || e.target == do_overlay_canvas) {
            e.preventDefault();
        }
    }, false);

    document.body.addEventListener("touchmove", function (e) {
        if (e.target == dz_overlay_canvas || e.target == do_overlay_canvas) {
            e.preventDefault();
        }
    }, false);

    window.addEventListener('gamepadconnected', (event) => {
      gamepadStateCheck();
    });

    // setInterval(updatePollingRate, 1000);
 
};

function gamepadStateCheck() 
{
    window.requestAnimationFrame(() => {
      gamepads = navigator.getGamepads();
      gamepad = gamepads[selected_gamepad];
      update_available_controllers();
      if (selected_gamepad < 0) return;
      padStatus();
      gamepadStateCheck();
    });
}

function update_available_controllers()
{
    let selectmenu = document.getElementById("controller_select");
    let options_count = selectmenu.childElementCount;
    while (gamepads.length < options_count - 1) selectmenu.remove(--options_count);
    for (let i = 0; i < gamepads.length; i++)
    {
        if (gamepads[i] === null) break;
        let option = selectmenu.item(i+1);
        if (option === null)
        {
            selectmenu.add(new Option(gamepads[i].id, (i+1).toString(), (i == 0)? true : false, (i == 0)? true : false));
        }
        else
        {
            option.innerHTML = gamepads[i].id;
        }
    }
    if (selectmenu.childElementCount > 1) selectmenu.item(0).innerHTML = "None";
    else selectmenu.item(0).innerHTML = "None Found";
}

function padStatus() {
    var raw_x = gamepad.axes[analog_stick + 0];
    var raw_y = gamepad.axes[analog_stick + 1];
    raw_x = (raw_x + 1)/2;
    raw_y = (raw_y + 1)/2;

    var mouseEvent = new MouseEvent("mousemove", {
            clientX: (do_overlay_canvas.width - 1) * raw_x + do_overlay_canvas.getBoundingClientRect().left,
            clientY: (do_overlay_canvas.height - 1) * raw_y + do_overlay_canvas.getBoundingClientRect().top
        });
    var mouseEvent2 = new MouseEvent("mousemove", {
            clientX: (dz_overlay_canvas.width - 1) * raw_x + dz_overlay_canvas.getBoundingClientRect().left,
            clientY: (dz_overlay_canvas.height - 1) * raw_y + dz_overlay_canvas.getBoundingClientRect().top
        });
    
    controller_x = raw_x * 2 - 1;
    controller_y = raw_y * (-2) + 1;
    controller_set_position = 2;
    if (dodge_stats) {
        dz_overlay_canvas.dispatchEvent(mouseEvent2);
        do_overlay_canvas.dispatchEvent(mouseEvent);
    } else {
        do_overlay_canvas.dispatchEvent(mouseEvent);
        dz_overlay_canvas.dispatchEvent(mouseEvent2);
    }
    
    
  }

function updatePollingRate() {
    if (gamepad.connected){
        var rate = gamepad.timestamp - previousPoll;
        previousPoll = gamepad.timestamp;
        console.log(rate);
    }   
}


// Get the position of a touch relative to the canvas
function getTouchPos(canvasDom, touchEvent) {
  var rect = canvasDom.getBoundingClientRect();
  return {
    x: touchEvent.touches[0].clientX - rect.left,
    y: touchEvent.touches[0].clientY - rect.top
  };
}

function slider_update(){
    getDeadzone();
    document.getElementById("slider_value").innerHTML = deadzone.toFixed(2);

    dz_container.markRectsDamaged();
    // Create the image
    dz_container.redraw();
    // Create the image
    do_container.markRectsDamaged();
    do_container.redraw();
}

function dodge_update(){
    getDodgeDeadzone();
    document.getElementById("dodge_slider_value").innerHTML = dodge_threshold.toFixed(2);

    do_container.markRectsDamaged();
    do_container.redraw();
}

function overlay_update(){
    overlay_on = document.getElementById("round_overlay").checked;
    max_diag = document.getElementById("max_diag").value;
    if (overlay_on){
        document.getElementById("max_diag").disabled = false;
    } else {
        document.getElementById("max_diag").disabled = true;
    }
    dz_overlay_container.markRectsDamaged();
    do_overlay_container.markRectsDamaged();
    dz_overlay_container.redraw();
    do_overlay_container.redraw();
}

function stick_update(){
    var is_checked = document.getElementById("right_stick").checked;
    if (is_checked){
        analog_stick = 2;
    } else {
        analog_stick = 0;
    }
}

function change_arrow(){
    alt_arrow = document.getElementById("alternate_arrow").checked;
}

function change_stats(){
    dodge_stats = document.getElementById("alternate_stats").checked;
}

function update_AA(){
    ss_factor = document.getElementById("AA").value;
    dz_container.markRectsDamaged();
    dz_container.redraw();
    do_container.markRectsDamaged();
    do_container.redraw();
    dz_overlay_container.markRectsDamaged();
    do_overlay_container.markRectsDamaged();
    dz_overlay_container.redraw();
    do_overlay_container.redraw();
}

function update_controller_select()
{
    selected_gamepad = parseInt(document.getElementById("controller_select").value) - 1;
    if (selected_gamepad >= 0) gamepadStateCheck();
}



// Create the image
function createDoBackground(context, width, height) {
    var half_width = (width-1)/2;
    var half_height = (height-1)/2;


 
    // Create an ImageData object
    var imagedata = context.createImageData(width, height);
    // Loop over all of the pixels
    for (var x=0; x<width; x++) {
        for (var y=0; y<height; y++) {
            // Get the pixel index
            var pixelindex = (y * width + x) * 4;

                var green_ss = 0;
                var red_ss = 0;
                var blue_ss = 0;

            if (ss_factor > 1) {
                var green = Create2DArray(ss_factor);
                var red = Create2DArray(ss_factor);
                var blue = Create2DArray(ss_factor);

                for (i=0; i < ss_factor; i++){
                    for (j=0; j < ss_factor; j++){

                        var true_x = (x +(i/ss_factor)) / half_width -1;
                        var true_y = (y + (j/ss_factor)) / half_height -1;
                        var game_coords = toGameCoordinates(true_x, true_y);
                        var game_x = game_coords.x;
                        var game_y = game_coords.y;

                        green[i][j] = 255;
                        red[i][j] = 0;
                        blue[i][j] = 0;


                        if (game_x == 0 && game_y == 0){
                            green[i][j] = 0;
                            red[i][j] = 255;
                            blue[i][j] = 0;
                        } else if (game_x == 0 || game_y == 0) {
                            if (Math.abs(game_x) >= dodge_threshold || Math.abs(game_y) >= dodge_threshold){
                                green[i][j] = 0;
                                red[i][j] = 0;
                                blue[i][j] = 255;
                            } else {
                                green[i][j] = 0;
                                red[i][j] = 255;
                                blue[i][j] = 0;
                            }
                        } else {
                            if (Math.abs(game_x) + Math.abs(game_y) < dodge_threshold){
                                green[i][j] = 0;
                                red[i][j] = 255;
                                blue[i][j] = 0;
                            } else if (Math.abs(game_x / game_y) < dodge_angle_snap || Math.abs(game_y / game_x) < dodge_angle_snap){
                                green[i][j] = 0;
                                red[i][j] = 0;
                                blue[i][j] = 255;
                            }
                        }
                    }
                }

                for (i=0; i < ss_factor; i++){
                    for (j=0; j < ss_factor; j++){

                        // green_ss += green[i][j];
                        // red_ss += red[i][j];
                        // blue_ss += blue[i][j];

                        green_ss += Math.pow(green[i][j],2);
                        red_ss += Math.pow(red[i][j],2);
                        blue_ss += Math.pow(blue[i][j],2);

                    }
                }

                var ss = ss_factor * ss_factor;

                // green_ss = green_ss/ss;
                // red_ss = red_ss/ss;
                // blue_ss = blue_ss/ss;

                green_ss = Math.pow(green_ss/ss, 1/2);
                red_ss = Math.pow(red_ss/ss, 1/2);
                blue_ss = Math.pow(blue_ss/ss, 1/2);
            } else {
                var true_x = x / (half_width-1) -1;
                var true_y = y / (half_height-1) -1;
                var game_coords = toGameCoordinates(true_x, true_y);
                var game_x = game_coords.x;
                var game_y = game_coords.y;

                green_ss = 255;
                red_ss = 0;
                blue_ss = 0;


                if (game_x == 0 && game_y == 0){
                    green_ss = 0;
                    red_ss = 255;
                    blue_ss = 0;
                } else if (game_x == 0 || game_y == 0) {
                    if (Math.abs(game_x) >= dodge_threshold || Math.abs(game_y) >= dodge_threshold){
                        green_ss = 0;
                        red_ss = 0;
                        blue_ss = 255;
                    } else {
                        green_ss = 0;
                        red_ss = 255;
                        blue_ss = 0;
                    }
                } else {
                    if (Math.abs(game_x) + Math.abs(game_y) < dodge_threshold){
                        green_ss = 0;
                        red_ss = 255;
                        blue_ss = 0;
                    } else if (Math.abs(game_x / game_y) < dodge_angle_snap || Math.abs(game_y / game_x) < dodge_angle_snap){
                        green_ss = 0;
                        red_ss = 0;
                        blue_ss = 255;
                    }
                }


            }
            


            // Set the pixel data
            imagedata.data[pixelindex] = red_ss;     // Red
            imagedata.data[pixelindex+1] = green_ss; // Green
            imagedata.data[pixelindex+2] = blue_ss;  // Blue
            imagedata.data[pixelindex+3] = 255;   // Alpha
        }
    }
    // Draw the image data to the canvas
    context.putImageData(imagedata, 0, 0);
}

// Create the image
function createDZBackground(context, width, height) {

    var half_width = (width-1)/2;
    var half_height = (height-1)/2;
 
    // Create an ImageData object
    var imagedata = context.createImageData(width, height);
    // Loop over all of the pixels
    for (var x=0; x<width; x++) {
        for (var y=0; y<height; y++) {
            // Get the pixel index
            var pixelindex = (y * width + x) * 4;

            var green = 0;
            var red = 0;
            var blue = 0;

            var true_x = x / (half_width-1) -1;
            var true_y = y / (half_height-1) -1;
            var game_coords = toGameCoordinates(true_x, true_y);
            var game_x = game_coords.x;
            var game_y = game_coords.y;

            green = 255;
            red = 0;
            blue = 0;


            if (game_x == 0 && game_y == 0){
                green = 0;
                red = 255;
                blue = 0;
            } else if (game_x == 0 || game_y == 0) {
                green = 255;
                red = 255;
                blue = 0;
            }
            


            // Set the pixel data
            imagedata.data[pixelindex] = red;     // Red
            imagedata.data[pixelindex+1] = green; // Green
            imagedata.data[pixelindex+2] = blue;  // Blue
            imagedata.data[pixelindex+3] = 255;   // Alpha
        }
    }
    // Draw the image data to the canvas
    context.putImageData(imagedata, 0, 0);
}

// Create the image
function createCircleOverlay(context, width, height) {
    var half_width = (width-1)/2;
    var half_height = (height-1)/2;

    var radius = Math.pow(2*(max_diag*max_diag), (1/2))


    // Create an ImageData object
    var imagedata = context.createImageData(width, height);
    // Loop over all of the pixels
    for (var x=0; x<width; x++) {
        for (var y=0; y<height; y++) {
            // Get the pixel index
            var pixelindex = (y * width + x) * 4;

                var alpha_ss = 0;

            if (ss_factor > 1) {
                var alpha = Create2DArray(ss_factor);

                for (i=0; i < ss_factor; i++){
                    for (j=0; j < ss_factor; j++){

                        var true_x = (x +(i/ss_factor)) / half_width -1;
                        var true_y = (y + (j/ss_factor)) / half_height -1;

                        alpha[i][j] = 200;


                        if (true_x * true_x + true_y * true_y <= radius * radius){
                            alpha[i][j] = 0;
                        }
                    }
                }

                for (i=0; i < ss_factor; i++){
                    for (j=0; j < ss_factor; j++){

                        alpha_ss += Math.pow(alpha[i][j],2);

                    }
                }

                var ss = ss_factor * ss_factor;


                alpha_ss = Math.pow(alpha_ss/ss, 1/2);
            } else {
                var true_x = x / (half_width-1) -1;
                var true_y = y / (half_height-1) -1;

                alpha_ss = 200;

                if (true_x * true_x + true_y * true_y <= radius * radius){
                    alpha_ss = 0;
                }


            }
            


            // Set the pixel data
            imagedata.data[pixelindex] = 0;     // Red
            imagedata.data[pixelindex+1] = 0; // Green
            imagedata.data[pixelindex+2] = 0;  // Blue
            imagedata.data[pixelindex+3] = alpha_ss;   // Alpha
        }
    }
    // Draw the image data to the canvas
    context.putImageData(imagedata, 0, 0);
}

function Create2DArray(rows) {
  var arr = [];

  for (var i=0;i<rows;i++) {
     arr[i] = [];
  }

  return arr;
}

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}


function toGameCoordinates(raw_x , raw_y){
    var game_x;
    var game_y;
    if (raw_x > 0) {
        if (raw_x > deadzone) {
            game_x = (raw_x- deadzone)/(1 - deadzone);
        } else {
            game_x = 0;
        }    
    } else {
        if (Math.abs(raw_x) > deadzone){
            game_x = (raw_x + deadzone)/(1 - deadzone);
        } else {
            game_x = 0;
        }
    }

    if (raw_y > 0) {
        if (raw_y > deadzone) {
            game_y = (raw_y - deadzone)/(1 - deadzone);
        } else {
            game_y = 0;
        }    
    } else {
        if (Math.abs(raw_y) > deadzone){
            game_y = (raw_y + deadzone)/(1 - deadzone);
        } else {
            game_y = 0;
        }
    }
    return {x:game_x, y:game_y};
}


function drawLineWithArrowhead(p0,p1,headLength, ctx, strength, coloured){

    // constants (could be declared as globals outside this function)
    var PI=Math.PI;
    var degreesInRadians225=225*PI/180;
    var degreesInRadians135=135*PI/180;

    // calc the angle of the line
    var dx=p1.x-p0.x;
    var dy=p1.y-p0.y;
    var angle=Math.atan2(dy,dx);

    // calc arrowhead points
    var x225=p1.x+headLength*Math.cos(angle+degreesInRadians225);
    var y225=p1.y+headLength*Math.sin(angle+degreesInRadians225);
    var x135=p1.x+headLength*Math.cos(angle+degreesInRadians135);
    var y135=p1.y+headLength*Math.sin(angle+degreesInRadians135);

    // draw line plus arrowhead
    ctx.beginPath();
    // draw the line from p0 to p1
    ctx.moveTo(p0.x,p0.y);
    ctx.lineTo(p1.x,p1.y);
    // draw partial arrowhead at 225 degrees
    ctx.moveTo(p1.x-1*Math.cos(angle+degreesInRadians225),p1.y-1*Math.sin(angle+degreesInRadians225));
    ctx.lineTo(x225,y225);
    // draw partial arrowhead at 135 degrees
    ctx.moveTo(p1.x+1*Math.cos(angle+degreesInRadians225),p1.y+1*Math.sin(angle+degreesInRadians225));
    ctx.lineTo(x135,y135);
    // stroke the line and arrowhead
    if (strength > 1) {
        strength = 1;
    } else if (strength < 0) {
        strength = 0;
    }
    var str = Math.floor(strength * 255);
    var inv = 187 - Math.floor((11/15)*str);
    if (str < 16){
        str = "0" + str.toString(16);
    } else {
        str = str.toString(16);
    }
    if (inv < 16){
        inv = "0" + inv.toString(16);
    } else {
        inv = inv.toString(16);
    }

    if (coloured){
        ctx.strokeStyle = '#' + '00' + inv + str;
    }

    ctx.lineWidth = 5.0; // 2.5
    ctx.stroke();
}

function drawCircleMouse(canvas_size, context){

    

    context.beginPath();
    context.arc(mousePos.x, mousePos.y, canvas_size/25, 0, 2 * Math.PI, false);
    context.fillStyle = "rgba(0, 0, 0, 0.7)";
    context.fill();
    
}

function drawDeadzoneArrow(canvas_size, context){

    var scale = nonDeadzoneSize(deadzone, canvas_size);

    if (!(game_coords.x == 0 && game_coords.y == 0)) {

        if (!alt_arrow){
            var p0={x:canvas_size/2, y:canvas_size/2};
            var p1={x:p0.x + game_coords.x*(canvas_size/2), y:p0.y - game_coords.y*(canvas_size/2)};
            drawLineWithArrowhead(p0, p1, 20, context, vecSizePercent(game_coords), true);
        } else {
            var p0={x:Math.round((mousePos.x - (game_coords.x * scale))),y:Math.round((mousePos.y + (game_coords.y * scale)))};
            // context.clearRect(0, 0, canvas_size, canvas_size);
            
            drawLineWithArrowhead(p0, mousePos, 20, context, vecSizePercent(game_coords), true);
        }

    }
    
}

function nonDeadzoneSize(deadzone, canvas_size){
    return (1-deadzone)*(canvas_size/2);
}

function vecSizePercent(vec){
    return Math.sqrt(vec.x * vec.x + vec.y * vec.y)/Math.sqrt(2);
}

function angleVector(vec){
    var out = 0;

    if (vec.x == 0 && vec.y == 0) {
        return "No direction.";
    } else if (vec.x >= 0 && vec.y <= 0){
        out = 90 + Math.degrees(Math.atan(-vec.y/vec.x));
    } else if (vec.x < 0 && vec.y < 0){
        out = 180 + Math.degrees(Math.atan(-vec.x/-vec.y));
    } else if (vec.x < 0){
        out = 270 + Math.degrees(Math.atan(vec.y/-vec.x));
    } else {
        out = Math.degrees(Math.atan(vec.x/vec.y));
    }


    return out;
}

// Converts from degrees to radians.
Math.radians = function(degrees) {
  return degrees * Math.PI / 180;
};

// Converts from radians to degrees.
Math.degrees = function(radians) {
  return radians * 180 / Math.PI;
};

function drawDodgeArrow(canvas_size, context){

    if (!(game_coords.x == 0 && game_coords.y == 0)) {

        var p0={x:canvas_size/2, y:canvas_size/2};
        var p1={x:p0.x + Math.sin(Math.radians(angle))*(canvas_size/2), y:p0.y - Math.cos(Math.radians(angle))*(canvas_size/2)};
       
        drawLineWithArrowhead(p0, p1, 20, context, 0, false);
    }
    
}

function angleDodge(vec){
    var out = 0;

    if (vec.x == 0 && vec.y == 0){
        return "No dodge.";
    } else if (vec.x >= 0 && vec.y <= 0){
        if (Math.abs(vec.y/vec.x) <= 0.1) {
            out = 90;
        } else if (Math.abs(vec.x/vec.y) <= 0.1) {
            out = 180;
        }  else {
            out = 90 + Math.degrees(Math.atan(-vec.y/vec.x));
        }
    } else if (vec.x < 0 && vec.y < 0){
        if (Math.abs(-vec.x/vec.y) <= 0.1) {
            out = 180;
        } else if (Math.abs(vec.y/vec.x) <= 0.1) {
            out = 270;
        }  else {
            out = 180 + Math.degrees(Math.atan(-vec.x/-vec.y));
        }
    } else if (vec.x < 0){
        if (Math.abs(vec.y/-vec.x) <= 0.1) {
            out = 270;
        } else if (Math.abs(vec.x/vec.y) <= 0.1) {
            out = 0;
        }  else {
            out = 270 + Math.degrees(Math.atan(vec.y/-vec.x));
        }
    } else {
        if (Math.abs(vec.x/vec.y) <= 0.1) {
            out = 0;
        } else if (Math.abs(vec.y/vec.x) <= 0.1) {
            out = 90;
        } else {
            out = Math.degrees(Math.atan(vec.x/vec.y));
        }
    }


    return out;
}

function toDodgeCoordinates(game_x , game_y){
    var dodge_x = 0;
    var dodge_y = 0;
    if (Math.abs(game_x) + Math.abs(game_y) >= dodge_threshold) {
        dodge_x = game_x;
        dodge_y = game_y;
    }
    return {x:dodge_x, y:dodge_y};
}

function getDeadzone(){
    deadzone = document.getElementById("deadzone_slider").value/100;
    return deadzone;
}

function getDodgeDeadzone(){
    dodge_threshold = document.getElementById("dodge_slider").value/100;
    return dodge_threshold;
}