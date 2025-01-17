// ============================
// APPLICATION & DATABASE SETUP 
// ============================

// System modules.
const fs = require('fs');
const path = require('path');

// Third-party libraries.
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

// Parsing & identifiers.
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

// Create the Express application and set the port.
const app = express();
const PORT = 3000;

// Generate a random 32-byte key and convert it to a hexadecimal string.
const secretKey = crypto.randomBytes(32).toString('hex');

// Configure session middleware using the secure key.
app.use(
	session({
		secret: secretKey,
		resave: false,
		saveUninitialized: true
	})
);

// Parse JSON and URL-encoded data from incoming requests.
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the "public" directory.
app.use(express.static(path.join(__dirname, '../public')));

// Path to the local database file.
const DB_PATH = path.join(__dirname, '../data/db.json');

// In-memory database object.
let dbData = { sessions: [], submissions: [] };

// Load database from file or create it if it doesn't exist.
function loadDatabase() {
	if (fs.existsSync(DB_PATH)) {
		const data = fs.readFileSync(DB_PATH);
		dbData = JSON.parse(data);
	} else {
		saveDatabase();
	}
}

// Save the current database state to the file.
function saveDatabase() {
	fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2));
}

// Initialize the database at startup.
loadDatabase();


// =====================
// AUTHENTICATION ROUTES 
// =====================

// Middleware to check if the user is authenticated.
function isAuthenticated(req, res, next) {
	if (req.session.user) {
		return next();
	}

	return res.status(401).json({ error: 'Unauthorized' });
}

// Login endpoint with basic validation.
app.post('/api/login', (req, res) => {
	const { username, password } = req.body;
	const validUsernames = [
		'Bordeaux',
		'Dijon',
		'Fréjus',
		'Laval',
		'Lille',
		'Paris',
		'Rennes',
		'Thonon',
		'Toulouse'
	];

	if (validUsernames.includes(username) && password === 'demo') {
		req.session.user = { username, campus: username };

		return res.json({
			success: true,
			message: 'Logged in successfully!',
			campus: username
		});
	}

	return res.json({
		success: false,
		message: 'Invalid credentials.'
	});
});

// Logout endpoint that destroys the session and redirects home.
app.get('/api/logout', (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			return res.status(500).json({ error: 'Could not log out. Please try again.' });
		}

		return res.redirect('/');
	});
});


// =============================
// SESSIONS & SUBMISSIONS ROUTES 
// =============================

// Check if the user is currently logged in and return campus info if they are.
app.get('/api/checkSession', (req, res) => {
	if (req.session.user) {
		return res.json({
			loggedIn: true,
			campus: req.session.user.campus
		});
	}

	return res.json({
		loggedIn: false,
		campus: null
	});
});

// Retrieve sessions for the logged-in user's campus.
app.get('/api/sessions', isAuthenticated, (req, res) => {
	const userCampus = req.session.user.campus;
	const sessions = dbData.sessions.filter((s) => s.campus === userCampus);

	return res.json(sessions);
});

// Create a new session under the user's campus.
app.post('/api/sessions', isAuthenticated, (req, res) => {
	const { name } = req.body;

	if (!name) {
		return res.status(400).json({ error: 'Session name is required.' });
	}

	const newSession = {
		id: uuidv4(),
		name,
		campus: req.session.user.campus,
		juries: [],
		students: []
	};

	dbData.sessions.push(newSession);

	saveDatabase();

	return res.json({
		message: 'Session created successfully!',
		session: newSession
	});
});

// Delete a session if it belongs to the user's campus.
app.delete('/api/sessions/:id', isAuthenticated, (req, res) => {
	const sessionId = req.params.id;
	const sessionIndex = dbData.sessions.findIndex((s) => s.id === sessionId);

	if (sessionIndex === -1) {
		return res.status(404).json({ error: 'Session not found.' });
	}

	const sessionToDelete = dbData.sessions[sessionIndex];

	if (sessionToDelete.campus !== req.session.user.campus) {
		return res.status(403).json({ error: 'Forbidden - Session belongs to another campus.' });
	}

	// Remove the session and any associated submissions.
	dbData.sessions.splice(sessionIndex, 1);
	dbData.submissions = dbData.submissions.filter(
		(sub) => sub.sessionId !== sessionId
	);

	saveDatabase();

	return res.json({ message: 'Session deleted successfully.' });
});


// ========================
// JURIES & STUDENTS ROUTES 
// ========================

// Add a jury to an existing session if authorized.
app.post('/api/sessions/:id/juries', isAuthenticated, (req, res) => {
	const sessionId = req.params.id;
	const { juryName } = req.body;

	if (!juryName) {
		return res.status(400).json({ error: 'Jury name is required.' });
	}

	const sessionFound = dbData.sessions.find((s) => s.id === sessionId);

	if (!sessionFound) {
		return res.status(404).json({ error: 'Session not found.' });
	}

	if (sessionFound.campus !== req.session.user.campus) {
		return res.status(403).json({ error: 'Forbidden - Session belongs to another campus.' });
	}

	sessionFound.juries.push(juryName);

	saveDatabase();

	return res.json({
		message: 'Jury added successfully.',
		session: sessionFound
	});
});

// Remove a jury from an existing session if authorized.
app.delete('/api/sessions/:id/juries', isAuthenticated, (req, res) => {
	const sessionId = req.params.id;
	const { juryName } = req.body;

	const sessionFound = dbData.sessions.find((s) => s.id === sessionId);

	if (!sessionFound) {
		return res.status(404).json({ error: 'Session not found.' });
	}

	if (sessionFound.campus !== req.session.user.campus) {
		return res.status(403).json({ error: 'Forbidden - Session belongs to another campus.' });
	}

	sessionFound.juries = sessionFound.juries.filter((j) => j !== juryName);

	saveDatabase();

	return res.json({
		message: 'Jury deleted successfully.',
		session: sessionFound
	});
});

// Add a student to an existing session if authorized.
app.post('/api/sessions/:id/students', isAuthenticated, (req, res) => {
	const sessionId = req.params.id;
	const { studentName } = req.body;

	if (!studentName) {
		return res.status(400).json({ error: 'Student name is required.' });
	}

	const sessionFound = dbData.sessions.find((s) => s.id === sessionId);

	if (!sessionFound) {
		return res.status(404).json({ error: 'Session not found.' });
	}

	if (sessionFound.campus !== req.session.user.campus) {
		return res.status(403).json({ error: 'Forbidden - Session belongs to another campus.' });
	}

	sessionFound.students.push(studentName);

	saveDatabase();

	return res.json({
		message: 'Student added successfully.',
		session: sessionFound
	});
});

// Remove a student from an existing session if authorized.
app.delete('/api/sessions/:id/students', isAuthenticated, (req, res) => {
	const sessionId = req.params.id;
	const { studentName } = req.body;

	const sessionFound = dbData.sessions.find((s) => s.id === sessionId);

	if (!sessionFound) {
		return res.status(404).json({ error: 'Session not found.' });
	}

	if (sessionFound.campus !== req.session.user.campus) {
		return res.status(403).json({ error: 'Forbidden - Session belongs to another campus.' });
	}

	sessionFound.students = sessionFound.students.filter((st) => st !== studentName);

	saveDatabase();

	return res.json({
		message: 'Student deleted successfully.',
		session: sessionFound
	});
});


// ============================
// EVALUATIONS & RESULTS ROUTES
// ============================

// Submit an evaluation for a student from a specific jury.
app.post('/api/submitEvaluation', isAuthenticated, (req, res) => {
	const {
		sessionId,
		juryName,
		studentName,
		introductionTeam,
		projectInspiration,
		technologyArchitecture,
		algorithmsCode,
		processCollaboration,
		challengesFaced,
		technicalLearnings,
		audibles,
		clarity,
		fewFillerWords,
		stagePosition,
		confidentPosture,
		professionalAttire,
		timeManagement,
		energy,
		audienceInteraction,
		projectFunctionality,
		questionsAnswers,
		studentComments
	} = req.body;

	const sessionFound = dbData.sessions.find((s) => s.id === sessionId);

	if (!sessionFound) {
		return res.status(400).json({ error: 'Session does not exist.' });
	}

	if (sessionFound.campus !== req.session.user.campus) {
		return res.status(403).json({ error: 'Forbidden - Session belongs to another campus.' });
	}

	if (!sessionFound.juries.includes(juryName)) {
		return res.status(400).json({ error: 'Jury does not exist in this session.' });
	}

	if (!sessionFound.students.includes(studentName)) {
		return res.status(400).json({ error: 'Student does not exist in this session.' });
	}

	const newSubmission = {
		sessionId,
		juryName,
		studentName,
		introductionTeam: parseFloat(introductionTeam),
		projectInspiration: parseFloat(projectInspiration),
		technologyArchitecture: parseFloat(technologyArchitecture),
		algorithmsCode: parseFloat(algorithmsCode),
		processCollaboration: parseFloat(processCollaboration),
		challengesFaced: parseFloat(challengesFaced),
		technicalLearnings: parseFloat(technicalLearnings),
		audibles: parseFloat(audibles),
		clarity: parseFloat(clarity),
		fewFillerWords: parseFloat(fewFillerWords),
		stagePosition: parseFloat(stagePosition),
		confidentPosture: parseFloat(confidentPosture),
		professionalAttire: parseFloat(professionalAttire),
		timeManagement: parseFloat(timeManagement),
		energy: parseFloat(energy),
		audienceInteraction: parseFloat(audienceInteraction),
		projectFunctionality: parseFloat(projectFunctionality),
		questionsAnswers: parseFloat(questionsAnswers),
		studentComments: studentComments || ''
	};

	dbData.submissions.push(newSubmission);

	saveDatabase();

	return res.json({ message: 'Evaluation submitted successfully!' });
});

// Retrieve raw submissions and calculate aggregated results for each student.
app.get('/api/resultsWithAverages', isAuthenticated, (req, res) => {
	const campus = req.session.user.campus;

	// Filter sessions and submissions belonging to the user's campus.
	const campusSessions = dbData.sessions.filter((s) => s.campus === campus);
	const campusSessionIds = campusSessions.map((s) => s.id);
	const rawSubmissions = dbData.submissions.filter((sub) => campusSessionIds.includes(sub.sessionId));

	// Aggregate results per sessionId/studentName.
	const aggregates = {};

	rawSubmissions.forEach((sub) => {
		const key = `${sub.sessionId}_${sub.studentName}`;

		if (!aggregates[key]) {
			aggregates[key] = {
				sessionId: sub.sessionId,
				studentName: sub.studentName,
				introductionTeam: 0,
				projectInspiration: 0,
				technologyArchitecture: 0,
				algorithmsCode: 0,
				processCollaboration: 0,
				challengesFaced: 0,
				technicalLearnings: 0,
				audibles: 0,
				clarity: 0,
				fewFillerWords: 0,
				stagePosition: 0,
				confidentPosture: 0,
				professionalAttire: 0,
				timeManagement: 0,
				energy: 0,
				audienceInteraction: 0,
				projectFunctionality: 0,
				questionsAnswers: 0,
				count: 0
			};
		}

		const agg = aggregates[key];
		agg.introductionTeam += sub.introductionTeam;
		agg.projectInspiration += sub.projectInspiration;
		agg.technologyArchitecture += sub.technologyArchitecture;
		agg.algorithmsCode += sub.algorithmsCode;
		agg.processCollaboration += sub.processCollaboration;
		agg.challengesFaced += sub.challengesFaced;
		agg.technicalLearnings += sub.technicalLearnings;
		agg.audibles += sub.audibles;
		agg.clarity += sub.clarity;
		agg.fewFillerWords += sub.fewFillerWords;
		agg.stagePosition += sub.stagePosition;
		agg.confidentPosture += sub.confidentPosture;
		agg.professionalAttire += sub.professionalAttire;
		agg.timeManagement += sub.timeManagement;
		agg.energy += sub.energy;
		agg.audienceInteraction += sub.audienceInteraction;
		agg.projectFunctionality += sub.projectFunctionality;
		agg.questionsAnswers += sub.questionsAnswers;
		agg.count += 1;
	});

	// Compute average scores for each aggregated entry.
	const aggregated = Object.values(aggregates).map((a) => ({
		sessionId: a.sessionId,
		studentName: a.studentName,
		introductionTeamAvg: a.introductionTeam / a.count,
		projectInspirationAvg: a.projectInspiration / a.count,
		technologyArchitectureAvg: a.technologyArchitecture / a.count,
		algorithmsCodeAvg: a.algorithmsCode / a.count,
		processCollaborationAvg: a.processCollaboration / a.count,
		challengesFacedAvg: a.challengesFaced / a.count,
		technicalLearningsAvg: a.technicalLearnings / a.count,
		audiblesAvg: a.audibles / a.count,
		clarityAvg: a.clarity / a.count,
		fewFillerWordsAvg: a.fewFillerWords / a.count,
		stagePositionAvg: a.stagePosition / a.count,
		confidentPostureAvg: a.confidentPosture / a.count,
		professionalAttireAvg: a.professionalAttire / a.count,
		timeManagementAvg: a.timeManagement / a.count,
		energyAvg: a.energy / a.count,
		audienceInteractionAvg: a.audienceInteraction / a.count,
		projectFunctionalityAvg: a.projectFunctionality / a.count,
		questionsAnswersAvg: a.questionsAnswers / a.count
	}));

	return res.json({
		rawSubmissions,
		aggregated,
		sessions: campusSessions
	});
});

// Only start the server if this file is run directly (not required by another file).
if (require.main === module) {
	app.listen(PORT, () => {
		console.log(`Server running at http://localhost:${PORT}`);
	});
}

// Export `app` for testing.
module.exports = app;
