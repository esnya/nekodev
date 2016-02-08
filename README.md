# Nekodev
Development environment and utilities for NekoRPG.

## Usage
1. Append into target project as git-submodule
    ```sh
    git submodule add https://github.com/ukatama/nekodev.git
    ```
2. Run `npm install` on `postinstall`
    ```json
    "scripts": {
        "postinstall": "cd nekodev && npm install"
    }
    ```
3. Call `nekodev/gulp` from `gulpfile.js`
    ```js
    require('./nekodev/gulp')(require('gulp'), options);
    ```