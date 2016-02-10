# Nekodev
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