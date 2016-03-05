# Nekodev
[![Build Status](https://img.shields.io/travis/ukatama/nekodev/master.svg?style=flat-square)](https://travis-ci.org/ukatama/nekodev)
[![PeerDependencies](https://img.shields.io/david/peer/ukatama/nekodev.svg?style=flat-square)](https://david-dm.org/ukatama/nekodev#info=peerDependencies&view=list)
[![Coverage Status](https://img.shields.io/coveralls/ukatama/nekodev.svg?style=flat-square)](https://coveralls.io/github/ukatama/nekodev)
[![Dependencies](https://img.shields.io/david/ukatama/nekodev.svg?style=flat-square)](https://david-dm.org/ukatama/nekodev)
[![DevDependencies](https://img.shields.io/david/dev/ukatama/nekodev.svg?style=flat-square)](https://david-dm.org/ukatama/nekodev#info=devDependencies&view=list)

Development environment and utilities for NekoRPG.

## Usage
1. Append into target project as git-submodule
    ```sh
    git submodule add https://github.com/ukatama/nekodev.git
    ```
2. Run install as local module
    ```sh
    npm install --sve-dev ./nekodev
    ```

    or

    ```json
    "devDependencies": {
        "nekodev": "file:./nekodev"
    }
    ```
3. Call `nekodev.gulp` with Object of options
    ```js
    require('nekodev').gulp({
        // Options
    });
    ```

## Example for `scripts` in `package.json`
```json
"scripts": {
    "start": "node .",
    "build": "gulp build",
    "test": "gulp test",
    "watch": "gulp watch"
}
```
