// Bakeoff #2 - Seleção de Alvos Fora de Alcance
// IPM 2021-22, Período 3
// Entrega: até dia 22 de Abril às 23h59 através do Fenix
// Bake-off: durante os laboratórios da semana de 18 de Abril

// p5.js reference: https://p5js.org/reference/

// Database (CHANGE THESE!)
const GROUP_NUMBER = "15-TP"; // Add your group number here as an integer (e.g., 2, 3)
const BAKE_OFF_DAY = false; // Set to 'true' before sharing during the bake-off day

// Target and grid properties (DO NOT CHANGE!)
let PPI, PPCM;
let TARGET_SIZE;
let TARGET_PADDING, MARGIN, LEFT_PADDING, TOP_PADDING;
let continue_button;
let inputArea = { x: 0, y: 0, h: 0, w: 0 }; // Position and size of the user input area

// Metrics
let testStartTime, testEndTime; // time between the start and end of one attempt (54 trials)
let hits = 0; // number of successful selections
let misses = 0; // number of missed selections (used to calculate accuracy)
let database; // Firebase DB

// Study control parameters
let draw_targets = false; // used to control what to show in draw()
let trials = []; // contains the order of targets that activate in the test
let current_trial = 0; // the current trial number (indexes into trials array above)
let attempt = 0; // users complete each test twice to account for practice (attemps 0 and 1)
let fitts_IDs = [0]; // add the Fitts ID for each selection here (-1 when there is a miss)

// Background color
let background_color;

// Target class (position and width)
class Target {
	constructor(x, y, w) {
		this.x = x;
		this.y = y;
		this.w = w;
	}
}

function preload() {
	let hit = loadSound("hit.wav");
	let miss = loadSound("miss.wav");
}

// Runs once at the start
function setup() {
	createCanvas(700, 500); // window size in px before we go into fullScreen()
	frameRate(60); // frame rate (DO NOT CHANGE!)

	// Set default background color
	background_color = color(0, 0, 0);

	randomizeTrials(); // randomize the trial order at the start of execution

	textFont("Arial", 18); // font size for the majority of the text
	drawUserIDScreen(); // draws the user start-up screen (student ID and display size)
}

// Runs every frame and redraws the screen
function draw() {
	if (draw_targets) {
		// Set background color accordingly
		background(background_color);

		// Print trial count at the top left-corner of the canvas
		fill(color(255, 255, 255));
		textAlign(LEFT);
		text("Trial " + (current_trial + 1) + " of " + trials.length, 50, 20);

		// Draw the virtual cursor
		let x = map(mouseX, inputArea.x, inputArea.x + inputArea.w, 0, width);
		let y = map(mouseY, inputArea.y, inputArea.y + inputArea.h, 0, height);

		// Draw the user input area
		drawInputArea();

		// Draw all 18 targets
		for (var i = 0; i < 18; i++) {
			drawTarget(x, y, i);
			drawTargetArea(x, y, i);
		}

		drawCursor(x, y);
		drawInstructions();
	}
}

// Print and save results at the end of 54 trials
function printAndSavePerformance() {
	// DO NOT CHANGE THESE!
	let accuracy = parseFloat(hits * 100) / parseFloat(hits + misses);
	let test_time = (testEndTime - testStartTime) / 1000;
	let time_per_target = nf(test_time / parseFloat(hits + misses), 0, 3);
	let penalty = constrain(
		(parseFloat(95) - parseFloat(hits * 100) / parseFloat(hits + misses)) * 0.2,
		0,
		100
	);
	let target_w_penalty = nf(
		test_time / parseFloat(hits + misses) + penalty,
		0,
		3
	);
	let timestamp =
		day() +
		"/" +
		month() +
		"/" +
		year() +
		"  " +
		hour() +
		":" +
		minute() +
		":" +
		second();

	background(color(0, 0, 0)); // clears screen
	fill(color(255, 255, 255)); // set text fill color to white
	text(timestamp, 10, 20); // display time on screen (top-left corner)

	textAlign(CENTER);
	text("Attempt " + (attempt + 1) + " out of 2 completed!", width / 2, 60);
	text("Hits: " + hits, width / 2, 100);
	text("Misses: " + misses, width / 2, 120);
	text("Accuracy: " + accuracy + "%", width / 2, 140);
	text("Total time taken: " + test_time + "s", width / 2, 160);
	text("Average time per target: " + time_per_target + "s", width / 2, 180);
	text(
		"Average time for each target (+ penalty): " + target_w_penalty + "s",
		width / 2,
		220
	);

	// Print Fitts IDS (one per target, -1 if failed selection, optional)
	text("Fitts Index of Performance", width / 2, 260);

	for (let i = 0; i < trials.length; ++i) {
		let x_pos = i / trials.length < 0.5 ? (2 * width) / 6 : (4 * width) / 6;

		let indexOfPerformance = fitts_IDs[i];
		let value;
		if (i === 0) {
			value = "---";
		} else if (indexOfPerformance < 0) {
			value = "MISSED";
		} else {
			value = round(indexOfPerformance, 3);
		}

		text(
			`Target ${i + 1}: ${value}`,
			x_pos,
			280 + 20 * (i % (trials.length / 2))
		);
	}

	// Saves results (DO NOT CHANGE!)
	let attempt_data = {
		project_from: GROUP_NUMBER,
		assessed_by: student_ID,
		test_completed_by: timestamp,
		attempt: attempt,
		hits: hits,
		misses: misses,
		accuracy: accuracy,
		attempt_duration: test_time,
		time_per_target: time_per_target,
		target_w_penalty: target_w_penalty,
		fitts_IDs: fitts_IDs,
	};

	// Send data to DB (DO NOT CHANGE!)
	if (BAKE_OFF_DAY) {
		// Access the Firebase DB
		if (attempt === 0) {
			firebase.initializeApp(firebaseConfig);
			database = firebase.database();
		}

		// Add user performance results
		let db_ref = database.ref("G" + GROUP_NUMBER);
		db_ref.push(attempt_data);
	}
}

// Mouse button was pressed - lets test to see if hit was in the correct target
function mousePressed() {
	// Only look for mouse releases during the actual test
	// (i.e., during target selections)
	if (draw_targets) {
		// Get the location and size of the target the user should be trying to select
		let target = getTargetBounds(trials[current_trial]);

		// Check to see if the virtual cursor is inside the target bounds,
		// increasing either the 'hits' or 'misses' counters
		if (insideInputArea(mouseX, mouseY)) {
			let virtual_x = map(
				mouseX,
				inputArea.x,
				inputArea.x + inputArea.w,
				0,
				width
			);
			let virtual_y = map(
				mouseY,
				inputArea.y,
				inputArea.y + inputArea.h,
				0,
				height
			);

			for (i = 0; i < 18; i++) {
				let current = getTargetBounds(i);
				if (isInsideSquare(virtual_x, virtual_y, current)) {
					virtual_x = current.x;
					virtual_y = current.y;
				}
			}

			// Hit
			if (isInsideTarget(virtual_x, virtual_y, target)) {
				hits++;
				background_color = color(0, 25, 0);
				if (current_trial < trials.length - 1) {
					fitts_IDs.push(
						calculateFittsID(virtual_x, virtual_y, trials[current_trial + 1])
					);
				}
				hit.play();
			}

			// Miss
			else {
				misses++;
				background_color = color(25, 0, 0);
				fitts_IDs.push(-1);
				miss.play();
			}

			current_trial++; // Move on to the next trial/target
		}

		// Check if the user has completed all 54 trials
		if (current_trial === trials.length) {
			testEndTime = millis();
			draw_targets = false; // Stop showing targets and the user performance results
			printAndSavePerformance(); // Print the user's results on-screen and send these to the DB
			attempt++;

			// If there's an attempt to go create a button to start this
			if (attempt < 2) {
				continue_button = createButton("START 2ND ATTEMPT");
				continue_button.mouseReleased(continueTest);
				continue_button.position(
					width / 2 - continue_button.size().width / 2,
					height / 2 - continue_button.size().height / 2
				);
			}
		}
		// Check if this was the first selection in an attempt
		else if (current_trial === 1) testStartTime = millis();
	}
}

// Determine if cursor is inside some snapping square
function isInsideSquare(x, y, target) {
	let t0 = getTargetBounds(0);
	let t1 = getTargetBounds(1);
	let distance = dist(t0.x, t0.y, t1.x, t1.y);

	return (
		x > target.x - distance / 2 &&
		x < target.x + distance / 2 &&
		y > target.y - distance / 2 &&
		y < target.y + distance / 2
	);
}

// Determine if cursor is inside the target
function isInsideTarget(x, y, target) {
	return dist(target.x, target.y, x, y) < target.w / 2;
}

// Draw snapping area around target
function drawTargetArea(x, y, i) {
	let target = getTargetBounds(i);
	noFill();
	strokeWeight(4);
	stroke(color(50, 50, 50));
	square(target.x - 1.5 * PPCM, target.y - 1.5 * PPCM, target.w * 2);
}

// Draw the cursor
function drawCursor(x, y) {
	stroke(color(0, 0, 0));
	strokeWeight(2);
	fill(color(255, 255, 255));
	circle(x, y, 0.5 * PPCM);
}

// Return the color of the target, based on its specifications
function getTargetColor(i) {
	if (isCurrentTarget(i)) {
		return color(255, 0, 0);
	} else if (isNextTarget(i)) {
		return color(255, 255, 255);
	} else {
		return color(155, 155, 155);
	}
}

function isPreviousTarget(i) {
	return current_trial - 1 >= 0 && trials[current_trial - 1] === i;
}

function isCurrentTarget(i) {
	return trials[current_trial] === i;
}

function isNextTarget(i) {
	return current_trial + 1 < trials.length && trials[current_trial + 1] === i;
}

// Draw target on-screen
function drawTarget(x, y, i) {
	// Get the location and size for target (i)
	let target = getTargetBounds(i);
	let curr_target = getTargetBounds(trials[current_trial]);

	// Current target
	if (isCurrentTarget(i)) {
		// Next target is current target
		if (isNextTarget(i)) {
			noFill();
			stroke(255, 255, 0);
			strokeWeight(4);
		}
	}

	// Previous target
	else if (isPreviousTarget(i)) {
		noFill();
		stroke(color(0, 200, 0));
		strokeWeight(6);
		line(target.x, target.y, curr_target.x, curr_target.y);
	}

	// Next target
	else if (isNextTarget(i)) {
		noFill();
		stroke(color(200, 200, 200));
		strokeWeight(4);
		line(target.x, target.y, curr_target.x, curr_target.y);
	}

	// Draws the target
	fill(getTargetColor(i));
	if (!(isCurrentTarget(i) && isNextTarget(i))) {
		noStroke();
	}
	circle(target.x, target.y, target.w);

	// Draw indicator that cursor snapped to target
	if (isInsideSquare(x, y, target)) {
		drawHoverIndicator(target);
	}

	// Draw input area rectangle
	drawInputAreaRectangle(target, i);
}

// Draw an indicator over the target
function drawHoverIndicator(target) {
	noStroke();
	fill(color(0, 255, 0));
	circle(target.x, target.y, target.w / 3);
}

// Draw the visual aid rectangle in the input area
function drawInputAreaRectangle(target, i) {
	let x = map(target.x, 0, width, inputArea.x, inputArea.x + inputArea.w);
	let y = map(target.y, 0, height, inputArea.y, inputArea.y + inputArea.h);

	rectMode(CENTER);
	fill(getTargetColor(i));
	if (isCurrentTarget(i) && isNextTarget(i)) {
		stroke(255, 255, 0);
		strokeWeight(4);
	}
	square(x, y, target.w * (inputArea.w / height));
	rectMode(CORNER);
}

function drawInstructions() {
	let startY = inputArea.y - TARGET_SIZE * 1.5;

	// Target
	fill(color(255, 0, 0));
	noStroke();
	circle(inputArea.x + TARGET_SIZE * 0.5, startY, TARGET_SIZE);
	fill(color(255, 255, 255));
	text("Alvo", inputArea.x + TARGET_SIZE * 1.7, startY);

	// Next Target
	fill(color(255, 255, 255));
	noStroke();
	circle(
		inputArea.x + inputArea.w / 2 + TARGET_SIZE * 0.5,
		startY,
		TARGET_SIZE
	);
	fill(255, 255, 255);
	text(
		"Próximo alvo",
		inputArea.x + inputArea.w / 2 + TARGET_SIZE * 1.7,
		startY
	);

	// Shift
	startY -= TARGET_SIZE * 1.5;

	// Clicar 2 vezes
	fill(color(255, 0, 0));
	stroke(color(255, 255, 0));
	strokeWeight(4);
	circle(inputArea.x + TARGET_SIZE * 0.5, startY, TARGET_SIZE);
	fill(color(255, 255, 255));
	noStroke();
	text("Clicar 2 vezes", inputArea.x + TARGET_SIZE * 1.7, startY);

	// Shift
	startY -= TARGET_SIZE * 1.5;

	// Dicas
	text(
		"O cursor transporta-se para o alvo mais próximo!",
		inputArea.x,
		inputArea.y + inputArea.h + 30
	);
	text(
		"Tente realizar a tarefa apenas olhando para o retângulo acima!",
		inputArea.x,
		inputArea.y + inputArea.h + 60
	);
}

function calculateFittsID(x, y, nextTarget) {
	let targetBounds = getTargetBounds(nextTarget);
	let distance = dist(x, y, targetBounds.x, targetBounds.y);

	return Math.log(distance / targetBounds.w + 1) / Math.log(2);
}

// Returns the location and size of a given target
function getTargetBounds(i) {
	var x =
		parseInt(LEFT_PADDING) +
		parseInt((i % 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);
	var y =
		parseInt(TOP_PADDING) +
		parseInt(Math.floor(i / 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);

	return new Target(x, y, TARGET_SIZE);
}

// Evoked after the user starts its second (and last) attempt
function continueTest() {
	// Re-randomize the trial order
	shuffle(trials, true);
	current_trial = 0;
	print("trial order: " + trials);

	// Resets performance variables
	hits = 0;
	misses = 0;
	fitts_IDs = [0];

	continue_button.remove();

	// Shows the targets again
	draw_targets = true;
	testStartTime = millis();

	// Rest background color
	background_color = color(0, 0, 0);
}

// Is invoked when the canvas is resized (e.g., when we go fullscreen)
function windowResized() {
	resizeCanvas(windowWidth, windowHeight);

	let display = new Display({ diagonal: display_size }, window.screen);

	// DO NOT CHANGE THESE!
	PPI = display.ppi; // calculates pixels per inch
	PPCM = PPI / 2.54; // calculates pixels per cm
	TARGET_SIZE = 1.5 * PPCM; // sets the target size in cm, i.e, 1.5cm
	TARGET_PADDING = 1.5 * PPCM; // sets the padding around the targets in cm
	MARGIN = 1.5 * PPCM; // sets the margin around the targets in cm

	// Sets the margin of the grid of targets to the left of the canvas (DO NOT CHANGE!)
	LEFT_PADDING = width / 3 - TARGET_SIZE - 1.5 * TARGET_PADDING - 1.5 * MARGIN;

	// Sets the margin of the grid of targets to the top of the canvas (DO NOT CHANGE!)
	TOP_PADDING = height / 2 - TARGET_SIZE - 3.5 * TARGET_PADDING - 1.5 * MARGIN;

	// Defines the user input area (DO NOT CHANGE!)
	inputArea = {
		x: width / 2 + 2 * TARGET_SIZE,
		y: height / 2,
		w: width / 3,
		h: height / 3,
	};

	// Starts drawing targets immediately after we go fullscreen
	draw_targets = true;
}

// Responsible for drawing the input area
function drawInputArea() {
	noFill();
	stroke(color(220, 220, 220));
	strokeWeight(2);

	rect(inputArea.x, inputArea.y, inputArea.w, inputArea.h);
}
