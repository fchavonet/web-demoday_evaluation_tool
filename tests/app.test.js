// =========
// UNITTESTS
// =========

// Third-party libraries
const request = require('supertest');
const { expect } = require('chai');

// Local modules
const app = require('../server/app');

describe('UNITTESTS', () => {
	// SuperTest agent to preserve session cookies.
	let agent;
	// Will store a session's ID for later tests.           
	let createdSessionId;

	// User credentials for testing.
	const validCampusUser = { username: 'Toulouse', password: 'demo' };
	const invalidCampusUser = { username: 'fakeUser', password: 'badPass' };

	// Names used in various tests.
	const juryName = 'Hugo';
	const studentName = 'Fabien';
	const sessionName = 'C#22';

	// Payload for submitting an evaluation.
	const evaluationPayload = {
		introductionTeam: '1',
		projectInspiration: '1',
		technologyArchitecture: '5',
		algorithmsCode: '5',
		processCollaboration: '2',
		challengesFaced: '5',
		technicalLearnings: '1',
		audibles: '1',
		clarity: '1',
		fewFillerWords: '1',
		stagePosition: '1',
		confidentPosture: '1',
		professionalAttire: '1',
		timeManagement: '1',
		energy: '1',
		audienceInteraction: '1',
		questionsAnswers: '1',
		studentComments: 'Well done!'
	};

	before(() => {
		// Create a SuperTest agent so session data (cookies) persist across requests.
		agent = request.agent(app);
	});


	// =====================
	// 	AUTHENTICATION TESTS
	// =====================

	describe('Authentication Routes:', () => {
		it('Should fail login with invalid credentials.', async () => {
			const res = await agent.post('/api/login').send(invalidCampusUser);
			expect(res.status).to.equal(200);
			expect(res.body.success).to.equal(false);
			expect(res.body.message).to.equal('Invalid credentials.');
		});

		it('Should succeed login with valid credentials.', async () => {
			const res = await agent.post('/api/login').send(validCampusUser);
			expect(res.status).to.equal(200);
			expect(res.body.success).to.equal(true);
			expect(res.body.message).to.equal('Logged in successfully!');
			expect(res.body.campus).to.equal(validCampusUser.username);
		});

		it('Should confirm the session is active.', async () => {
			const res = await agent.get('/api/checkSession');
			expect(res.status).to.equal(200);
			expect(res.body.loggedIn).to.equal(true);
			expect(res.body.campus).to.equal(validCampusUser.username);
		});
	});


	// =========================
	// SESSIONS MANAGEMENT TESTS
	// =========================

	describe('Sessions Routes:', () => {
		it('Should create a new session.', async () => {
			const res = await agent.post('/api/sessions').send({ name: sessionName });
			expect(res.status).to.equal(200);
			expect(res.body).to.have.property('session');
			expect(res.body.session).to.be.an('object');
			expect(res.body.session.name).to.equal(sessionName);
			expect(res.body.session.campus).to.equal(validCampusUser.username);

			createdSessionId = res.body.session.id;
		});

		it('Should retrieve the session just created.', async () => {
			const res = await agent.get('/api/sessions');
			expect(res.status).to.equal(200);
			expect(res.body).to.be.an('array');

			const foundSession = res.body.find((s) => s.id === createdSessionId);
			expect(foundSession).to.exist;
			expect(foundSession.name).to.equal(sessionName);
		});

		it('Should fail if session name is missing.', async () => {
			const res = await agent.post('/api/sessions').send({});
			expect(res.status).to.equal(400);
			expect(res.body.error).to.equal('Session name is required.');
		});
	});


	// ==================================
	// JURIES & VSTUDENTS MANAGEMENT TEST
	// ==================================

	describe('Juries & Students Routes:', () => {
		it('Should add a jury to the session.', async () => {
			const res = await agent.post(`/api/sessions/${createdSessionId}/juries`).send({ juryName });
			expect(res.status).to.equal(200);
			expect(res.body.session).to.be.an('object');
			expect(res.body.session.juries).to.include(juryName);
		});

		it('Should add a student to the session.', async () => {
			const res = await agent.post(`/api/sessions/${createdSessionId}/students`).send({ studentName });
			expect(res.status).to.equal(200);
			expect(res.body.session.students).to.include(studentName);
		});
	});


	// ===========================
	// EVALUATIONS & RESULTS TESTS
	// ===========================

	describe('Evaluation & Results Routes:', () => {
		it('Should submit an evaluation.', async () => {
			const res = await agent.post('/api/submitEvaluation').send({
				sessionId: createdSessionId,
				juryName: juryName,
				studentName: studentName,
				...evaluationPayload
			});
			expect(res.status).to.equal(200);
			expect(res.body.message).to.equal('Evaluation submitted successfully!');
		});

		it('Should retrieve raw submissions and aggregated data.', async () => {
			const res = await agent.get('/api/resultsWithAverages');
			expect(res.status).to.equal(200);

			const { rawSubmissions, aggregated, sessions } = res.body;
			expect(rawSubmissions).to.be.an('array');
			expect(aggregated).to.be.an('array');
			expect(sessions).to.be.an('array');

			const matchingSubmission = rawSubmissions.find((sub) => {
				return (sub.sessionId === createdSessionId && sub.juryName === juryName && sub.studentName === studentName
				);
			});
			expect(matchingSubmission).to.exist;
			expect(matchingSubmission.introductionTeam).to.equal(1);

			const matchingAggregate = aggregated.find((agg) => {
				return (agg.sessionId === createdSessionId && agg.studentName === studentName);
			});
			expect(matchingAggregate).to.exist;
			expect(matchingAggregate.introductionTeamAvg).to.equal(1);
		});
	});


	// ==================
	// CLEANUP PROCEDURES
	// ==================

	describe('Cleanup Routes:', () => {
		it('Should remove the jury from the session.', async () => {
			const res = await agent.delete(`/api/sessions/${createdSessionId}/juries`).send({ juryName });
			expect(res.status).to.equal(200);
			expect(res.body.message).to.equal('Jury deleted successfully.');
		});

		it('Should remove the student from the session.', async () => {
			const res = await agent.delete(`/api/sessions/${createdSessionId}/students`).send({ studentName });
			expect(res.status).to.equal(200);
			expect(res.body.message).to.equal('Student deleted successfully.');
		});

		it('Should delete the session.', async () => {
			const res = await agent.delete(`/api/sessions/${createdSessionId}`).send();
			expect(res.status).to.equal(200);
			expect(res.body.message).to.equal('Session deleted successfully.');
		});

		it('Should confirm the session is no longer returned.', async () => {
			const res = await agent.get('/api/sessions');
			expect(res.status).to.equal(200);
			const stillExists = res.body.some((s) => s.id === createdSessionId);
			expect(stillExists).to.equal(false);
		});
	});


	// ==================
	// FINAL LOGOUT TESTS
	// ==================

	describe('Final Logout:', () => {
		it('Should log out and destroy the session.', async () => {
			const res = await agent.get('/api/logout');
			expect([200, 302]).to.include(res.status);
		});

		it('Should now fail checkSession.', async () => {
			const res = await agent.get('/api/checkSession');
			expect(res.status).to.equal(200);
			expect(res.body.loggedIn).to.equal(false);
		});

		// Add a newline for better readability in test output.
		after(() => {
			console.log();
		});
	});
});