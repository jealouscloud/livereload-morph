{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.bun
    pkgs.chromium
  ];

  # Use nix chromium for playwright tests
  shellHook = ''
    export CHROMIUM_PATH="${pkgs.chromium}/bin/chromium"
  '';
}
