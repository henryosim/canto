package PomCur::Role::Exporter;

=head1 NAME

PomCur::Role::Exporter - Code for exporting

=head1 SYNOPSIS

=head1 AUTHOR

Kim Rutherford C<< <kmr44@cam.ac.uk> >>

=head1 BUGS

Please report any bugs or feature requests to C<kmr44@cam.ac.uk>.

=head1 SUPPORT

You can find documentation for this module with the perldoc command.

    perldoc PomCur::Role::Exporter

=over 4

=back

=head1 COPYRIGHT & LICENSE

Copyright 2012 Kim Rutherford, all rights reserved.

This program is free software; you can redistribute it and/or modify it
under the same terms as Perl itself.

=head1 FUNCTIONS

=cut

use Moose::Role;
use Carp;
use Getopt::Long qw(GetOptionsFromArray);

use PomCur::Curs::State qw/:all/;

has options => (is => 'ro', isa => 'ArrayRef', required => 1);
has parsed_options => (is => 'rw', isa => 'HashRef', init_arg => undef);
has state => (is => 'rw', isa => 'PomCur::Curs::State', init_arg => undef);
has track_schema => (is => 'rw', isa => 'PomCur::TrackDB', init_arg => undef);
has current_user => (is => 'ro', isa => 'PomCur::TrackDB::Person',
                     required => 1);
has state_after_export => (is => 'rw', init_arg => undef);

requires 'config';

sub BUILD
{
  my $self = shift;

  my %parsed_options = ();

  my @opt_config = ('stream-mode!' => \$parsed_options{stream_mode},
                    'all-data!' => \$parsed_options{all_data},
                    'dump-approved!' => \$parsed_options{dump_approved},
                    'export-approved!' => \$parsed_options{export_approved},
                    );
  if (!GetOptionsFromArray($self->options(), @opt_config)) {
    croak "option parsing failed for: @{$self->options()}";
  }

  $self->parsed_options(\%parsed_options);

  $self->state(PomCur::Curs::State->new(config => $self->config()));

  if ($parsed_options{export_approved}) {
    $self->state_after_export(EXPORTED)
  }

  my $track_schema = PomCur::TrackDB->new(config => $self->config());
  $self->track_schema($track_schema);

  my $curs_rs = $track_schema->resultset('Curs');

  if ($parsed_options{dump_approved} || $parsed_options{export_approved}) {
    $curs_rs = $curs_rs->search({ 'type.name' => 'annotation_status',
                                  'cursprops.value' => 'APPROVED',
                                  'cv.name' => 'PomCur cursprop types', },
                                { join => { cursprops => { type => 'cv' } } });
  }

  $parsed_options{curs_resultset} = $curs_rs;
}

after 'export' => sub {
  my $self = shift;

  if (defined $self->state_after_export()) {
    my $track_schema = $self->track_schema();

    my $curs_rs =
      $self->parsed_options()->{curs_resultset} // $track_schema->resultset('Curs');
    $curs_rs->reset();

    while (defined (my $curs = $curs_rs->next())) {
      my $curs_key = $curs->curs_key();
      my $curs_schema = PomCur::Curs::get_schema_for_key($self->config(), $curs_key);
      $self->state()->set_state($curs_schema, $self->state_after_export(),
                                { current_user => $self->current_user() });
    }
  }
};

1;