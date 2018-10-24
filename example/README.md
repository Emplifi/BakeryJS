# BakeryJS Example Project

This is a minimal example of BakeryJS project, with generator and processor components. Take a look at project structure and individual files. Especially take a look at:

- [index.js](index.js) – Shows how to run the program and data flow description
- [helloworld generator](components/generators/helloworld.js)
- [wordcount processor](components/processors/wordcount.js)

## Project Structure

- [index.js](index.js) – Entry point for the project
- [components/](components/) – Root directory of components (boxes) available for flows; the components are further separated into:
    - [generators/](components/generators/) – Components which generate data for the flow (e.g. consume from queue or just make things up)
    - [processors/](components/processors/) – Components which convert, enrich and generally process data in the flow.

This is a recommended structure of `components` directory, but it is up to you. Each component is added to flow based on its `name` property in metadata.

## Try It Out

```
npm install
npm start
```

This will output the data flow, traces of messages as they are sent between components and messages which are "drained":

```
dispatch on flow description:
building flow from SchemaObject
* process **********************************************************************
* SERIAL -----------------------------------------------------------------------
* | CONCURRENT -----------------------------------------------------------------
* |   - helloworld
* | ----------------------------------------------------------------------------
* | CONCURRENT -----------------------------------------------------------------
* |   - wordcount
* |   - punctcount
* | ----------------------------------------------------------------------------
* | CONCURRENT -----------------------------------------------------------------
* |   - checksum
* | ----------------------------------------------------------------------------
* ------------------------------------------------------------------------------
********************************************************************************

Program run ----->
10:27:32 AM Sent: _root_ --> helloworld (1)
10:27:32 AM Sent: helloworld --> punctcount (1)
10:27:32 AM Sent: helloworld --> wordcount (1)
10:27:32 AM Sent: punctcount --> checksum (1)
10:27:32 AM Sent: wordcount --> checksum (1)
Drain received a message { jobId: '0',
  msg: 'Hello world!',
  punct: 3,
  words: 3,
  checksum: 7.242640687119286 }
10:27:32 AM Sent: helloworld --> punctcount (2)
10:27:32 AM Sent: helloworld --> wordcount (2)
10:27:32 AM Sent: punctcount --> checksum (1)
10:27:32 AM Sent: wordcount --> checksum (1)
10:27:32 AM Sent: punctcount --> checksum (1)
10:27:32 AM Sent: wordcount --> checksum (1)
Drain received a message { jobId: '0',
  msg: '¡Hola mundo!',
  punct: 3,
  words: 4,
  checksum: 8.65685424949238 }
Drain received a message { jobId: '0',
  msg: 'Ahoj světe!',
  punct: 4,
  words: 4,
  checksum: 9.65685424949238 }
10:27:33 AM Sent: helloworld --> punctcount (2)
10:27:33 AM Sent: helloworld --> wordcount (2)
10:27:33 AM Sent: punctcount --> checksum (1)
10:27:33 AM Sent: wordcount --> checksum (1)
10:27:33 AM Sent: punctcount --> checksum (1)
10:27:33 AM Sent: wordcount --> checksum (1)
Drain received a message { jobId: '0',
  msg: 'Hallo Welt!',
  punct: 3,
  words: 3,
  checksum: 7.242640687119286 }
Drain received a message { jobId: '0',
  msg: 'Bonjour monde!',
  punct: 3,
  words: 3,
  checksum: 7.242640687119286 }
10:27:33 AM Sent: helloworld --> punctcount (1)
10:27:33 AM Sent: helloworld --> wordcount (1)
10:27:33 AM Sent: punctcount --> checksum (1)
10:27:33 AM Sent: wordcount --> checksum (1)
```
