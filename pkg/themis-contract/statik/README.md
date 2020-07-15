# Static assets for Themis Contract

Static assets are compressed and packaged into [statik.go](./statik.go) in this
folder by way of the [statik](https://github.com/rakyll/statik) utility.

The [Makefile](../../../Makefile) automatically rebuilds the `statik.go` file
prior to building the application, so you generally shouldn't need to worry
about doing this manually.
