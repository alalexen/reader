# Third-Party Notices

This project uses third-party open-source software and pretrained language resources.

## HebPipe

HebPipe provides the Hebrew tokenizer resources and pretrained Hebrew segmentation model used by Hebrew Reader.

- Project: https://github.com/amir-zeldes/HebPipe
- PyPI: https://pypi.org/project/hebpipe/
- Author: Amir Zeldes
- Version used: 4.0.2.0
- Code license: Apache License 2.0

HebPipe is installed as a Python package, but Hebrew Reader does not load HebPipe's full NLP pipeline.

HebPipe's own license notice states that some language-model resources may use licenses different from the Apache 2.0 code license.

## RFTokenizer

RFTokenizer performs the actual Hebrew word segmentation used by HebPipe.

- Project: https://github.com/amir-zeldes/RFTokenizer
- PyPI: https://pypi.org/project/rftokenizer/
- Author: Amir Zeldes
- Version used: 2.2.0
- Code license: Apache License 2.0

Hebrew Reader pins RFTokenizer 2.2.0 because HebPipe 4.0.2.0 uses the legacy Python 3 `.sm3` model format supported by that version.

## Hebrew segmentation resources

RFTokenizer's upstream documentation states that the data supplied for its Hebrew segmentation experiment is derived from the Universal Dependencies Hebrew Treebank and is made available under CC BY-NC-SA 4.0.

- RFTokenizer documentation:
  https://github.com/amir-zeldes/RFTokenizer
- UD Hebrew HTB:
  https://github.com/UniversalDependencies/UD_Hebrew-HTB
- CC BY-NC-SA 4.0:
  https://creativecommons.org/licenses/by-nc-sa/4.0/

The pretrained `heb.sm3` and `heb.seg` model files are downloaded locally during setup and are not committed to this repository.

HebPipe explicitly warns that language-model resources may have separate licensing terms. This notice therefore does not claim that every model artifact is licensed under Apache 2.0.

## Other dependencies

Additional Python and browser dependencies retain their own upstream licenses.

## Scope

These notices document third-party software and resources used by Hebrew Reader. They do not replace, modify, or reinterpret the upstream licenses.
