#!/bin/bash
ganache-cli --fork \
  $NODE_URL@12917834 \
  --unlock "0x0b7376f2a063c771d460210a4fa8787c9a7379f9"	\
  --unlock "0xcf61932d5956d0b6f788bd95d76e2ad58416d7d6"	\
  --unlock "0x4f295d8eabfc0e11d99db02bc02a265d82d7ba76" \
  --unlock "0x52A5711Dc4fe437E81205bfaD22fFC43F1818Df7" \
  --gasPrice 0
