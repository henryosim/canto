use strict;
use warnings;
use Test::More;

use PomCur::TestUtil;

use Plack::Test;
use Plack::Util;
use HTTP::Request;

my $test_util = PomCur::TestUtil->new();
$test_util->init_test();

my $app = $test_util->plack_app()->{app};

my $cookie_jar = $test_util->cookie_jar();

$test_util->enable_access_control();

test_psgi $app, sub {
    my $cb = shift;

    my $req = HTTP::Request->new(GET => 'http://localhost:5000/');

    my $res = $cb->($req);

    is $res->code, 302;
    my $redirect_url = $res->header('location');
    my $redirect_req = HTTP::Request->new(GET => $redirect_url);
    my $redirect_res = $cb->($redirect_req);

    ok ($redirect_res->content() =~ /Log in to continue/);
    ok ($redirect_res->content() !~ /Reports/);

    $test_util->app_login($cookie_jar, $cb);
    $cookie_jar->add_cookie_header($req);

    $res = $cb->($req);
    ok ($res->content() =~ /Reports/);
    like ($cookie_jar->as_string(), qr[PomCur_root_session=[0-9a-f]+]);
};

done_testing;
