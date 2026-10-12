const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function makeRequest(method, path, data, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);
        const options = {
            hostname: url.hostname,
            port: url.port || 5000,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function testClassCreation() {
    try {
        console.log('🔐 Step 1: Logging in...');
        const loginResponse = await makeRequest('POST', '/api/login', {
            email: 'prashsantraj813@gmail.com',
            password: 'Educ@t!onal$123',
            userType: 'SuperAdmin'
        });

        if (!loginResponse.data.success) {
            console.error('❌ Login failed:', loginResponse.data);
            return;
        }

        const token = loginResponse.data.data.token;
        const instutionCode = loginResponse.data.data.user.InstutionCode;
        console.log('✅ Login successful');
        console.log(`   Institution Code: ${instutionCode}`);
        console.log(`   Token: ${token.substring(0, 20)}...`);

        // Test 1: Create first class
        console.log('\n📝 Test 1: Creating first class "5th" for session "2026-2027"...');
        const classData1 = {
            Class_Name: '5th',
            Session: '2026-2027',
            Session_Start_Day: '2026-01-15',
            Session_End_Day: '2027-01-15'
        };

        try {
            const createResponse1 = await makeRequest('POST', '/api/class/class-Register', classData1, token);
            if (createResponse1.status === 201 || createResponse1.status === 200) {
                console.log('✅ First class created successfully!');
                console.log(`   ClassCode: ${createResponse1.data.data.ClassCode}`);
                console.log(`   ClassName: ${createResponse1.data.data.ClassName}`);
                console.log(`   Session: ${createResponse1.data.data.Session}`);
            } else {
                console.log('❌ First class creation failed:');
                console.log(`   Status: ${createResponse1.status}`);
                console.log(`   Message: ${createResponse1.data.message}`);
                console.log(`   Error: ${createResponse1.data.error}`);
                if (createResponse1.data.existingClass) {
                    console.log(`   Existing Class: ${JSON.stringify(createResponse1.data.existingClass, null, 2)}`);
                }
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }

        // Test 2: Try to create duplicate class (same name, same session)
        console.log('\n📝 Test 2: Attempting to create duplicate class "5th" for session "2026-2027"...');
        const classData2 = {
            Class_Name: '5th',
            Session: '2026-2027',
            Session_Start_Day: '2026-01-14',
            Session_End_Day: '2027-01-14'
        };

        try {
            const createResponse2 = await makeRequest('POST', '/api/class/class-Register', classData2, token);
            if (createResponse2.status === 201 || createResponse2.status === 200) {
                console.log('❌ ERROR: Duplicate class was created! This should not happen.');
                console.log(`   ClassCode: ${createResponse2.data.data.ClassCode}`);
            } else if (createResponse2.status === 400) {
                console.log('✅ Duplicate correctly prevented!');
                console.log(`   Status: ${createResponse2.status}`);
                console.log(`   Message: ${createResponse2.data.message}`);
                if (createResponse2.data.existingClass) {
                    console.log(`   Existing Class Found: ${createResponse2.data.existingClass.ClassName} (${createResponse2.data.existingClass.ClassCode})`);
                }
            } else {
                console.log('⚠️  Unexpected response:');
                console.log(`   Status: ${createResponse2.status}`);
                console.log(`   Message: ${createResponse2.data.message || 'N/A'}`);
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }

        // Test 3: Create class with different name
        console.log('\n📝 Test 3: Creating class "6th" for session "2026-2027"...');
        const classData3 = {
            Class_Name: '6th',
            Session: '2026-2027',
            Session_Start_Day: '2026-01-15',
            Session_End_Day: '2027-01-15'
        };

        try {
            const createResponse3 = await makeRequest('POST', '/api/class/class-Register', classData3, token);
            if (createResponse3.status === 201 || createResponse3.status === 200) {
                console.log('✅ Different class created successfully!');
                console.log(`   ClassCode: ${createResponse3.data.data.ClassCode}`);
                console.log(`   ClassName: ${createResponse3.data.data.ClassName}`);
            } else {
                console.log('❌ Different class creation failed:');
                console.log(`   Status: ${createResponse3.status}`);
                console.log(`   Message: ${createResponse3.data.message || 'N/A'}`);
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }

        // Test 4: Create same class name but different session
        console.log('\n📝 Test 4: Creating class "5th" for different session "2027-2028"...');
        const classData4 = {
            Class_Name: '5th',
            Session: '2027-2028',
            Session_Start_Day: '2027-01-15',
            Session_End_Day: '2028-01-15'
        };

        try {
            const createResponse4 = await makeRequest('POST', '/api/class/class-Register', classData4, token);
            if (createResponse4.status === 201 || createResponse4.status === 200) {
                console.log('✅ Same name, different session created successfully!');
                console.log(`   ClassCode: ${createResponse4.data.data.ClassCode}`);
                console.log(`   ClassName: ${createResponse4.data.data.ClassName}`);
                console.log(`   Session: ${createResponse4.data.data.Session}`);
            } else {
                console.log('❌ Same name different session creation failed:');
                console.log(`   Status: ${createResponse4.status}`);
                console.log(`   Message: ${createResponse4.data.message || 'N/A'}`);
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }

        console.log('\n✅ All tests completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testClassCreation();

