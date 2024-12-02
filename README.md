# Quirk-E
Quirk-E is an extension of the Quirk [1]. Quirk-E has been developed as part of the DEQSE project at the University of Jyväskylä, Finland. 

The Quirk-E tool, which has been presented in [2] (https://doi.org/), adds more functionalities to the Quirk [1] quantum circuit simulator.

The Quirk-E is free to use and modify. However, you must add reference #[2] in case of any publication.

Access Quirk-E via:

-Web Browser: [quirk-e.dev](https://quirk-e.dev/)

-DEQSE Visual Studio Code Extension: [GitHub Repository](https://github.com/DEQSE-Project/deqse-vscode-extension) | [Microsoft Marketplace](https://marketplace.visualstudio.com/publishers/jyuqicteam)








This work has been supported by the Academy of Finland (project DEQSE 349945).

# Features

- **Drag and Drop Barrier (Slicer)** for quantum circuits like in qiskit.

- **Dependencies have been updated** resolving several vulnerabilities caused by out-of-date packages.

![Drag and Drop Barrier (Slicer) Feature](https://github.com/DEQSE-Project/Quirk-E/blob/main/Quirk-E.jpg)


# Known issues

- **Some vulnerable dependencies** still remain due to some developer dependencies having vulnerable versions of `lodash` and `traceur` as sub-dependencies.

# Installation

Clone the repository.

`git clone https://github.com/DEQSE-Project/Quirk-E` 

`cd Quirk-E`

`npm install`

`npm run`

`npm run build`

Confirm the output works by opening out/quirk.html with a web browser.

# Contributors

- Samuel Ovaskainen ([@0wsk](https://github.com/0wsk)), *University of Jyväskylä*
- Majid Haghparast ([@MajidHaghparast](https://github.com/MajidHaghparast)), *University of Jyväskylä*

# Contact

Majid Haghparast <<majid.m.haghparast@jyu.fi>>

# References

[1] https://github.com/Strilanc/Quirk

[2] 


