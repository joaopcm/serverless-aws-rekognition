'use strict';

const {
  default: { get },
} = require('axios');

class Handler {
  constructor({ rekoService, translatorService }) {
    this.rekoService = rekoService;
    this.translatorService = translatorService;
  }

  async detectImageLabels(buffer) {
    const result = await this.rekoService
      .detectLabels({
        Image: {
          Bytes: buffer,
        },
      })
      .promise();

    const workingItems = result.Labels.filter(
      ({ Confidence }) => Confidence > 80
    );

    const names = workingItems.map(({ Name }) => Name).join(' and ');

    return { names, workingItems };
  }

  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data);

    return buffer;
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text,
    };

    const { TranslatedText } = await this.translatorService
      .translateText(params)
      .promise();

    return TranslatedText.split(' e');
  }

  formatTextResults(texts, workingItems) {
    const finalText = [];

    for (const index in texts) {
      const nameInPortuguese = texts[index];
      const confidence = workingItems[index].Confidence;

      finalText.push(
        `${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`
      );
    }

    return finalText.join('\n');
  }

  async main(event) {
    try {
      console.log('downloading image...');
      const { imageUrl } = event.queryStringParameters;
      const imageBuffer = await this.getImageBuffer(imageUrl);

      console.log('detecting labels...');
      const { names, workingItems } = await this.detectImageLabels(imageBuffer);

      console.log('translating to Portuguese...');
      const texts = await this.translateText(names);

      console.log('handling final object...');
      const finalText = this.formatTextResults(texts, workingItems);

      console.log('finishing...');

      return {
        statusCode: 200,
        body: `A imagem tem\n`.concat(finalText),
      };
    } catch (error) {
      console.log('Error', error.stack);
      return {
        statusCode: 500,
        body: 'Internal server error',
      };
    }
  }
}

// factory
const aws = require('aws-sdk');
const reko = new aws.Rekognition();
const translator = new aws.Translate();
const handler = new Handler({
  rekoService: reko,
  translatorService: translator,
});

module.exports.main = handler.main.bind(handler);
