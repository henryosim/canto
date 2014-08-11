use strict;
use warnings;
use Test::More tests => 42;
use Test::Deep;

use Canto::TestUtil;
use Canto::Curs::ServiceUtils;

my $test_util = Canto::TestUtil->new();

$test_util->init_test('curs_annotations_2');

my $config = $test_util->config();
my $curs_key = 'aaaa0007';
my $curs_schema = Canto::Curs::get_schema_for_key($config, $curs_key);

my $service_utils = Canto::Curs::ServiceUtils->new(curs_schema => $curs_schema,
                                                   config => $config);

my $res = $service_utils->list_for_service('genotype');

cmp_deeply($res,
           [
            {
              'identifier' => 'h+ SPCC63.05delta ssm4KE',
              'name' => undef,
              genotype_id => 1,
            },
            {
              'identifier' => 'h+ ssm4-D4',
              'name' => undef,
              genotype_id => 2,
            }
          ]);

$res = $service_utils->list_for_service('gene');

cmp_deeply($res,
           [
            {
              'primary_identifier' => 'SPCC576.16c',
              'primary_name' => 'wtf22',
               gene_id => 1,
            },
            {
              'primary_name' => 'ssm4',
              'primary_identifier' => 'SPAC27D7.13c',
               gene_id => 2,
            },
            {
              'primary_name' => 'doa10',
              'primary_identifier' => 'SPBC14F5.07',
               gene_id => 3,
            },
            {
              'primary_identifier' => 'SPCC63.05',
              'primary_name' => undef,
               gene_id => 4,
            },
          ]);

my $gene_identifier = 'SPBC14F5.07';
my $genotype_identifier = 'h+ SPCC63.05delta ssm4KE';

my $first_gene =
  $curs_schema->resultset('Gene')->find({ primary_identifier => $gene_identifier });
my $first_genotype =
  $curs_schema->resultset('Genotype')->find({ identifier => $genotype_identifier });

my $first_gene_annotation = $first_gene->direct_annotations()->first();
my $first_genotype_annotation = $first_genotype->annotations()->first();

my $c2d7_identifier = 'SPAC27D7.13c';
my $c2d7_gene = $curs_schema->resultset('Gene')->find({ primary_identifier => $c2d7_identifier });

my $new_comment = "new service comment";
my $changes = {
  key => $curs_key,
  submitter_comment => $new_comment,
};

$res = $service_utils->change_annotation($first_genotype_annotation->annotation_id(),
                                         'new', $changes);

is ($res->{status}, 'success');
is ($res->{annotation}->{term_ontid}, 'FYPO:0000013');
is ($res->{annotation}->{genotype_identifier}, $genotype_identifier);
is ($res->{annotation}->{submitter_comment}, $new_comment);

# re-query
$first_genotype_annotation = $first_genotype->annotations()->first();

is ($first_genotype_annotation->data()->{submitter_comment}, $new_comment);


# test change a term
$res = $service_utils->change_annotation($first_genotype_annotation->annotation_id(),
                                         'new',
                                         {
                                           key => $curs_key,
                                           term_ontid => 'FYPO:0000133'
                                         });
is ($res->{status}, 'success');
# re-query
$first_genotype_annotation = $first_genotype->annotations()->first();
is ($first_genotype_annotation->data()->{term_ontid}, "FYPO:0000133");
is ($res->{annotation}->{term_ontid}, 'FYPO:0000133');
is ($res->{annotation}->{term_name}, 'elongated multinucleate cells');


# test setting evidence_code
$res = $service_utils->change_annotation($first_genotype_annotation->annotation_id(),
                                         'new',
                                         {
                                           key => $curs_key,
                                           evidence_code => "IDA",
                                         });
is ($res->{status}, 'success');
# re-query
$first_genotype_annotation = $first_genotype->annotations()->first();
is ($first_genotype_annotation->data()->{evidence_code}, "IDA");
is ($res->{annotation}->{with_or_from_identifier}, undef);

# test setting conditions
my $new_conditions = [
  {
    name => 'low temperature',
  },
  {
    name => 'some free text cond',
  }
];
$res = $service_utils->change_annotation($first_genotype_annotation->annotation_id(),
                                         'new',
                                         {
                                           key => $curs_key,
                                           conditions => $new_conditions,
                                         });
is ($res->{status}, 'success');
# re-query
$first_genotype_annotation = $first_genotype->annotations()->first();
my @res_conditions = @{$first_genotype_annotation->data()->{conditions}};

cmp_deeply(\@res_conditions, ['PECO:0000006', 'some free text cond']);


# test illegal evidence_code
$res = $service_utils->change_annotation($first_genotype_annotation->annotation_id(),
                                         'new',
                                         {
                                           key => $curs_key,
                                           evidence_code => "illegal",
                                         });
is ($res->{status}, 'error');
is ($res->{message}, 'no such evidence code: illegal');


# test illegal curs_key
$res = $service_utils->change_annotation($first_genotype_annotation->annotation_id(),
                                         'new',
                                         {
                                           key => 'illegal',
                                           evidence_code => "IDA",
                                         });
is ($res->{status}, 'error');
is ($res->{message}, 'incorrect key');


# test illegal field type
$res = $service_utils->change_annotation($first_genotype_annotation->annotation_id(),
                                         'new',
                                         {
                                           key => $curs_key,
                                           illegal => "something",
                                         });
is ($res->{status}, 'error');
is ($res->{message}, 'no such annotation field type: illegal');


# test setting with_gene/with_or_from_identifier for a gene
$res = $service_utils->change_annotation($first_gene_annotation->annotation_id(),
                                         'new',
                                         {
                                           key => $curs_key,
                                           submitter_comment => 'a short comment',
                                           with_gene_id => $c2d7_gene->gene_id(),
                                         });
is ($res->{status}, 'success');
is ($res->{annotation}->{with_or_from_identifier}, $c2d7_gene->primary_identifier());
is ($res->{annotation}->{submitter_comment}, 'a short comment');

# re-query
$first_genotype_annotation = $first_genotype->annotations()->first();
is ($first_genotype_annotation->data()->{evidence_code}, "IDA");



# create a new Annotation
is ($c2d7_gene->direct_annotations()->count(), 1);

$res = $service_utils->create_annotation({
                                           key => $curs_key,
                                           feature_id => $c2d7_gene->gene_id(),
                                           feature_type => 'gene',
                                           annotation_type => 'molecular_function',
                                           term_ontid => 'GO:0022857',
                                           evidence_code => 'IDA',
                                         });
is ($res->{status}, 'success');
is ($res->{annotation}->{gene_identifier}, $c2d7_identifier);
is ($res->{annotation}->{annotation_type}, 'molecular_function');
is ($res->{annotation}->{term_ontid}, 'GO:0022857');
is ($res->{annotation}->{term_name}, 'transmembrane transporter activity');
is ($res->{annotation}->{evidence_code}, 'IDA');
is ($res->{annotation}->{submitter_comment}, undef);
is ($res->{annotation}->{curator}, 'Some Testperson <some.testperson@pombase.org>');

is ($c2d7_gene->direct_annotations()->count(), 2);

my $new_annotation_id = $res->{annotation}->{annotation_id};

my $new_annotation = $curs_schema->find_with_type('Annotation', $new_annotation_id);
is ($new_annotation->data()->{term_ontid}, 'GO:0022857');


# test lack of information
$res = $service_utils->create_annotation({
                                           key => $curs_key,
                                         });
is ($res->{status}, 'error');
is ($res->{message}, 'No feature_id passed to create annotation service');

# delete
$res = $service_utils->delete_annotation({
                                           key => $curs_key,
                                           annotation_id => $new_annotation_id,
                                         });

is ($c2d7_gene->direct_annotations()->count(), 1);
is ($curs_schema->resultset('Annotation')->search({ annotation_id => $new_annotation_id })->count(), 0);


my $cond_res = $service_utils->list_for_service('condition');

cmp_deeply($cond_res, [ { term_id => 'PECO:0000006', name => 'low temperature' },
                        { name => 'some free text cond' } ]);
