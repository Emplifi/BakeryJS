# ![BakeryJS](assets/logo.png)

[![npm version](https://img.shields.io/npm/v/bakeryjs.svg?style=flat-square)](https://www.npmjs.com/package/bakeryjs)
[![Travis build status](https://img.shields.io/travis/com/Socialbakers/BakeryJS.svg?style=flat-square)](https://travis-ci.com/Socialbakers/BakeryJS)

BakeryJS is a Node.js framework for handling common data processing needs.

Why would you need it? Think of how you process data with many small-scale data manipulations. The data is retrieved, shaped, extended, stored, and sent to UI. Imagine you divide complex data processing tasks into smaller reusable components or “Boxes” (Black box with your business logic). BakeryJS gives you straightforward options to connect these boxes into data flows to solve your tasks.

BakeryJS runs your Boxes asynchronously and deals with different processing speed of each Box. With BakeryJS you will gain observability and various options to run your Data Flows.

## Project Status

**Initial Public Beta**

In Socialbakers we use BakeryJS internally on production projects, but there are still many rough edges, especially regarding documentation and public API. We are looking for your feedback to know how to make BakeryJS generally useful outside of our company. Please [write an issue](https://github.com/Socialbakers/BakeryJS/issues) if you have any questions or comments.

## Features

-   Provides common abstraction for data processing,
-   supports prepared and dynamic flows,
-   works nicely with existing code,
-   no special deployment needs,
-   built-in observability and tracing (planned),
-   extensibility via plugins (planned).

## Usage

Install the package via npm:

```
npm install bakeryjs
```

See the [example folder](example/) for example project structure with explanation.

## Namings

- Program: The main entry point of the application, it loads Components and builds Data Flow from the given Job description.
- Component / Box: A single piece of logic, it can _require_, _provide_ and _emit_ messages. Generally depending on its behavior it can be:
    - Generator: Generates messages, e.g. reads input queue or listens on socket.
    - Processor: Receives incoming messages and processes them further, e.g. enriches messages with additional data, converts them to different format or emits additional messages derived from incoming messages.
- Message: An object exchanged between Components, its properties correspond to specific `provides`, `emits`, and `requires` definitions of component.
- Data Flow: A configuration of Components which exchange data.
- Job: A piece of work received by the Program, it contains Data Flow and optionally settings for boxes and input parameters.


## Contributing

See [Contribution Guidelines](CONTRIBUTING.md).

## Acknowledgments

BakeryJS was originally inspired by [Apache NiFi](https://nifi.apache.org/) and [Luigi by Spotify](https://github.com/spotify/luigi).

## See Also

-   [NoFlo](https://noflojs.org/) and [Flowhub](https://flowhub.io/)
-   [Apache NiFi](https://nifi.apache.org/)
-   [Luigi](https://github.com/spotify/luigi)
-   [Flow-based Programming](http://www.jpaulmorrison.com/fbp/)
-   [awesome-pipeline](https://github.com/pditommaso/awesome-pipeline)
-   [awesome-frp-js](https://github.com/stoeffel/awesome-frp-js) for Functional Reactive Programming in JavaScript

## Resources

- Article [Bake Your Data With BakeryJS](https://medium.com/socialbakers-engineering/bake-your-data-with-bakeryjs-3a7636cfff82)

## License

MIT
