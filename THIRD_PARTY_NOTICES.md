# Third-Party Notices

This project is personal and non-commercial.

## HebPipe

HebPipe is used as the local Hebrew NLP and morphological-analysis dependency.

- Project: https://github.com/amir-zeldes/HebPipe
- PyPI: https://pypi.org/project/hebpipe/
- Author: Amir Zeldes
- Code license: Apache License 2.0
- Installed package version: 4.0.2.0

HebPipe is installed as a Python dependency and its source code is not copied into this repository.

## HebPipe language-model resources

HebPipe's LICENSE.md states that while the HebPipe code is licensed under Apache License 2.0,
some resources used for language models may use different licenses.

This repository does not vendor HebPipe model files, training datasets, or downloaded model
resources. They remain local to the developer machine and retain their upstream license and
attribution requirements.

- HebPipe licensing note:
  https://github.com/amir-zeldes/HebPipe/blob/master/LICENSE.md
- HebPipe model documentation:
  https://github.com/amir-zeldes/HebPipe

## Transitive dependencies

HebPipe installs additional third-party Python packages required by its NLP pipeline.
Those packages are transitive dependencies of HebPipe rather than direct dependencies
declared by Hebrew Reader, and each retains its own upstream license.

## Scope

The notices in this file document third-party software and resources used by this project.
They do not modify or replace the licenses of those third-party projects or model resources.
