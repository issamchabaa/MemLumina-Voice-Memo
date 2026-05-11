const { v2 } = require('@google-cloud/speech');

async function createRecognizer() {
  const client = new v2.SpeechClient({
    apiEndpoint: 'us-central1-speech.googleapis.com'
  });

  const projectId = 'sheep-db1';
  const location = 'us-central1';
  const recognizerId = 'memlumina-chirp-2';

  const parent = `projects/${projectId}/locations/${location}`;

  console.log(`Creating recognizer: ${parent}/recognizers/${recognizerId}`);

  try {
    const [operation] = await client.createRecognizer({
      parent,
      recognizerId,
      recognizer: {
        model: 'chirp-2',
        languageCodes: ['en-US'],
      },
    });

    console.log('Waiting for operation...');
    const [response] = await operation.promise();
    console.log('Recognizer created:', response.name);
  } catch (error) {
    if (error.code === 6) {
      console.log('Recognizer already exists.');
    } else {
      console.error('Error creating recognizer:', error);
    }
  }
}

createRecognizer();
