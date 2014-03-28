# Canto installation
## Requirements
- Linux, BSD or UNIX
- Perl, CLucene library

## Manual installation

### Software requirements

The following software is needed for the installation:

- Perl
- Git
- GCC (for compiling part of the Perl libraries)
- Make
- CLucene v0.9.*
- Module::Install and Module::Install::Catalyst

### Supported systems

Canto should be installable on any system that supports the software requirements.
These instructions have been tested on Debian (v7.0+) and Ubuntu (v12.04+).

### Installing prerequisites on Debian and Ubuntu

On Debian and Ubuntu, the software requirements can be installed using the
package manager:

    sudo apt-get install perl gcc g++ tar gzip bzip2 make git-core wget \
      libmodule-install-perl libcatalyst-devel-perl liblocal-lib-perl

To improve the installation speed, these packages can optionally be installed
before proceeding:

    sudo apt-get install libhash-merge-perl \
      libhtml-mason-perl libplack-perl libdbix-class-perl \
      libdbix-class-schema-loader-perl libcatalyst-modules-perl libio-all-lwp-perl \
      libwww-perl libjson-xs-perl libio-all-perl \
      libio-string-perl libmemoize-expirelru-perl libtry-tiny-perl \
      libarchive-zip-perl libtext-csv-xs-perl liblingua-en-inflect-number-perl \
      libcatalyst-modules-perl libmoose-perl libdata-compare-perl \
      libmoosex-role-parameterized-perl libfile-copy-recursive-perl \
      libxml-simple-perl libtext-csv-perl libtest-deep-perl \
      libtext-markdown-perl libchi-driver-memcached-perl libchi-perl \
      libcache-memcached-perl libcache-perl libfile-touch-perl \
      libcatalyst-engine-psgi-perl \
      liblwp-protocol-psgi-perl libweb-scraper-perl \
      libdbd-pg-perl libdata-javascript-anon-perl

If these packages aren't installed, these Perl modules will be installed using
CPAN, which is slower.

[CLucene](http://clucene.sourceforge.net/) is required by Canto. For
Debian version 7 ("wheezy") and earlier and Ubuntu version 13.04 ("Raring")
and earlier it can be installed with:

    sudo apt-get install libclucene-dev libclucene0ldbl

For Ubuntu version 13.10 the correct CLucene library version must be
installed manually. The Perl CLucene modules is currently only compatible
with CLucene version 0.9.* but Ubuntu v13.10 ships with CLucene v2.3.3.4.

On Ubuntu v13.10 the old CLucene library can be installed with:

    wget http://www.mirrorservice.org/sites/archive.ubuntu.com/ubuntu//pool/main/c/clucene-core/libclucene0ldbl_0.9.21b-2build1_amd64.deb
    wget http://www.mirrorservice.org/sites/archive.ubuntu.com/ubuntu//pool/main/c/clucene-core/libclucene-dev_0.9.21b-2build1_amd64.deb
    sudo dpkg -i libclucene0ldbl_0.9.21b-2build1_amd64.deb libclucene-dev_0.9.21b-2build1_amd64.deb

### Installing prerequisites on Centos/Red Hat
If you have added
[RPMforge](http://wiki.centos.org/AdditionalResources/Repositories/RPMForge)
as an extra [Centos](http://www.centos.org/) package repository many of the
required Perl libraries can be installed with `yum`.

These are suggested packages to install:

    sudo yum groupinstall "Development Tools"
    sudo yum install perl cpan git perl-Module-Install

### Getting the Canto source code
Currently the easiest way to get the code is via GitHub. Run this command
to get a copy:

    git clone https://github.com/pombase/canto.git

This creates a directory called "`canto`". The directory can be updated
later with the command:

    git pull

### Downloading an archive file

Alternatively, GitHub provides archive files for the current version:

- https://github.com/pombase/canto/archive/master.zip
- https://github.com/pombase/canto/archive/master.tar.gz

Note after unpacking, you'll have a directory called `canto-master`. The text
below assumes `canto` so:

    mv canto-master canto

### CPAN tips
It's best to configure the CPAN client before starting the Canto
installation. Start it with:

    cpan

When started, cpan will attempt to configure itself. Usually the default
answer at each prompt will work.

Use these commands at the `cpan` prompt avoid lots of questions while
installing modules later.

    o conf prerequisites_policy follow
    o conf build_requires_install_policy no
    o conf commit

Confirm that `Module::Install` and co are installed with (at the `cpan`
prompt):

    install Module::Install
    install Module::Install::Catalyst

Quit cpan and return to the shell prompt with:

    exit

### Install dependencies
In the `canto` directory:

    perl Makefile.PL
    make installdeps
    make

Answer "yes" to the "Auto-install the X mandatory module(s) from CPAN?"
prompt.

### Run the tests
To check that all prerequisites are installed and that the code Canto tests
pass:

    make test

## Canto in a Virtual machine
Canto can be tested in a virtual machine using
[VirtualBox](http://www.virtualbox.org) and
[Vagrant](http://www.vagrantup.com/). This combination is available on Linux,
MacOS and Windows.

These instructions have been tested on a 64 bit host.

### Installing VirtualBox

Installation packages for VirtualBox are available here:
  https://www.virtualbox.org/wiki/Downloads

On some operating systems, packages may be available from the default
repositories:

* Debian: https://wiki.debian.org/VirtualBox
* Ubuntu: https://help.ubuntu.com/community/VirtualBox
* Red Hat/Centos: http://wiki.centos.org/HowTos/Virtualization/VirtualBox

### Installing Vagrant

Installation instructions for Vagrant are here:
http://docs.vagrantup.com/v2/installation/index.html

Users of recent versions of Debian and Ubuntu can install with:

    apt-get install vagrant

### Canto via Vagrant

Once VirtualBox and Vagrant are installed, use these commands to create a
virtual machine, install the operating system (Ubuntu) and install Canto and
its dependencies:

    cd canto
    vagrant box add precise64 http://files.vagrantup.com/precise64.box
    vagrant up

The `vagrant` commands will many minutes to complete. If everything is
successful, once `vagrant up` returns you can `ssh` to the virtual machine
with:

    vagrant ssh

From that shell, the Canto server can be started with:

    cd canto
    ./script/canto_start

Once started the server can be accessed on port 5500 of the host:
http://localhost:5500/

## Testing the installation
To try the Canto server:

### Initialise the data directory
Make a data directory somewhere:

    mkdir /tmp/canto-test

From the `canto` directory:

    ./script/canto_start --init /tmp/canto-test

This will initialise the `canto-test` directory and will create a
configuration file (`canto_deploy.yaml`) that can be customised.

### Run the server
Again, from the `canto` directory.

    ./script/canto_start

### Visit the application start page
The application should now be running at http://localhost:5000
