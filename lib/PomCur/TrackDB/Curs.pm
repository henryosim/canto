package PomCur::TrackDB::Curs;

# Created by DBIx::Class::Schema::Loader
# DO NOT MODIFY THE FIRST PART OF THIS FILE

use strict;
use warnings;

use Moose;
use MooseX::NonMoose;
use namespace::autoclean;
extends 'DBIx::Class::Core';


=head1 NAME

PomCur::TrackDB::Curs

=cut

__PACKAGE__->table("curs");

=head1 ACCESSORS

=head2 curs_id

  data_type: 'integer'
  is_auto_increment: 1
  is_nullable: 0

=head2 assigned_curator

  data_type: 'integer'
  is_foreign_key: 1
  is_nullable: 1

=head2 pub

  data_type: 'integer'
  is_foreign_key: 1
  is_nullable: 0

=head2 curs_key

  data_type: 'text'
  is_nullable: 0

=cut

__PACKAGE__->add_columns(
  "curs_id",
  { data_type => "integer", is_auto_increment => 1, is_nullable => 0 },
  "assigned_curator",
  { data_type => "integer", is_foreign_key => 1, is_nullable => 1 },
  "pub",
  { data_type => "integer", is_foreign_key => 1, is_nullable => 0 },
  "curs_key",
  { data_type => "text", is_nullable => 0 },
);
__PACKAGE__->set_primary_key("curs_id");

=head1 RELATIONS

=head2 pub

Type: belongs_to

Related object: L<PomCur::TrackDB::Pub>

=cut

__PACKAGE__->belongs_to(
  "pub",
  "PomCur::TrackDB::Pub",
  { pub_id => "pub" },
  { is_deferrable => 1, on_delete => "CASCADE", on_update => "CASCADE" },
);

=head2 assigned_curator

Type: belongs_to

Related object: L<PomCur::TrackDB::Person>

=cut

__PACKAGE__->belongs_to(
  "assigned_curator",
  "PomCur::TrackDB::Person",
  { person_id => "assigned_curator" },
  {
    is_deferrable => 1,
    join_type     => "LEFT",
    on_delete     => "CASCADE",
    on_update     => "CASCADE",
  },
);


# Created by DBIx::Class::Schema::Loader v0.07006 @ 2011-05-11 15:27:46
# DO NOT MODIFY THIS OR ANYTHING ABOVE! md5sum:6mEv/rHvG3e7LwpSy1wV2w


# You can replace this text with custom content, and it will be preserved on regeneration
__PACKAGE__->meta->make_immutable;
1;
