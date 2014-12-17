package Canto::Curs::AlleleManager;

=head1 NAME

Canto::Curs::AlleleManager - Curs Allele CRUD functions

=head1 SYNOPSIS

=head1 AUTHOR

Kim Rutherford C<< <kmr44@cam.ac.uk> >>

=head1 BUGS

Please report any bugs or feature requests to C<kmr44@cam.ac.uk>.

=head1 SUPPORT

You can find documentation for this module with the perldoc command.

    perldoc Canto::Curs::AlleleManager

=over 4

=back

=head1 COPYRIGHT & LICENSE

Copyright 2013 Kim Rutherford, all rights reserved.

This program is free software; you can redistribute it and/or modify it
under the same terms as Perl itself.

=head1 FUNCTIONS

=cut

use Carp;
use Moose;

has curs_schema => (is => 'rw', isa => 'Canto::CursDB', required => 1);
has gene_manager => (is => 'rw', isa => 'Canto::Curs::GeneManager',
                     lazy_build => 1);

with 'Canto::Role::Configurable';
with 'Canto::Curs::Role::GeneResultSet';

sub _build_gene_manager
{
  my $self = shift;

  return Canto::Curs::GeneManager->new(config => $self->config(),
                                       curs_schema => $self->curs_schema());
}

sub _create_allele_uniquename
{
  my $gene_primary_identifier = shift;
  my $schema = shift;
  my $curs_key = shift;

  my $prefix = "$gene_primary_identifier:$curs_key-";

  my $rs = $schema->resultset('Allele')
    ->search({ 'gene.primary_identifier' => $gene_primary_identifier,
               'me.primary_identifier' => { -like => "$prefix%" } },
             { join => 'gene' });

  my $new_index = 1;

  while (defined (my $allele = $rs->next())) {
    if ($allele->primary_identifier() =~ /^$prefix(\d+)$/) {
       if ($1 >= $new_index) {
         $new_index = $1 + 1;
       }
     }
   }

   return "$gene_primary_identifier:$curs_key-$new_index";
}

# create a new Allele from the data or return an existing matching allele
sub allele_from_json
{
  my $self = shift;
  my $json_allele = shift;
  my $curs_key = shift;

  my $config = $self->config();
  my $schema = $self->curs_schema();

  my $primary_identifier = $json_allele->{primary_identifier};
  my $name = $json_allele->{name};
  my $description = $json_allele->{description};
  my $expression = $json_allele->{expression};
  my $allele_type = $json_allele->{type};
  my $gene_id = $json_allele->{gene_id};

  if ($primary_identifier) {
    # lookup existing allele
    my $allele = undef;

    $allele = $schema->resultset('Allele')
      ->find({
        primary_identifier => $primary_identifier,
      });

    if (!$allele) {
      my $lookup = Canto::Track::get_adaptor($config, 'allele');

      my $allele_details = $lookup->lookup_by_uniquename($primary_identifier);

      if (!defined $allele_details) {
        die qq(internal error - allele "$primary_identifier" is missing);
      }

      # we will store the allele from Chado in the CursDB
      $allele_type = $allele_details->{allele_type};
      $description = $allele_details->{description};
      $name = $allele_details->{name};
      $expression = $allele_details->{expression};

      my $gene_identifier = $allele_details->{gene_uniquename};

      my $gene_rs = $self->get_ordered_gene_rs($schema);
      my $curs_gene = $gene_rs->find({
        primary_identifier => $gene_identifier,
      });

      if (!defined $curs_gene) {
        my $gene_lookup = Canto::Track::get_adaptor($config, 'gene');
        my $lookup_result = $gene_lookup->lookup([$gene_identifier]);
        my %new_gene_details =
          $self->gene_manager()->create_genes_from_lookup($lookup_result);

        $curs_gene = $new_gene_details{$gene_identifier};
      }

      $gene_id = $curs_gene->gene_id();
    };

    if ($allele) {
      return $allele;
    }
  } else {
    my $gene = $schema->find_with_type('Gene', $gene_id);

    $primary_identifier =
      _create_allele_uniquename($gene->primary_identifier(),
                                $schema, $curs_key);
  }

  my %create_args = (
    primary_identifier => $primary_identifier,
    type => $allele_type,
    description => $description,
    name => $name,
    gene => $gene_id,
    expression => $expression,
  );

  return $schema->create_with_type('Allele', \%create_args);
}

1;